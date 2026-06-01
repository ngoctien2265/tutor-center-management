from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Review
from .serializers import ReviewSerializer, ReviewCreateUpdateSerializer
from .services import ReviewService


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['class_id', 'star_rating']
    search_fields = ['user_id__username', 'class_id__subject_name']
    ordering_fields = ['created_at', 'star_rating']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ReviewCreateUpdateSerializer
        return ReviewSerializer

    def perform_create(self, serializer):
        serializer.save(user_id=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_reviews(self, request):
        """Get reviews given by current user"""
        reviews = Review.objects.filter(user_id=request.user)
        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def class_reviews(self, request):
        """Get reviews for a specific class"""
        class_id = request.query_params.get('class_id')
        if not class_id:
            return Response(
                {'detail': 'class_id query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reviews = Review.objects.filter(class_id=class_id)
        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def average_rating(self, request):
        """Get average rating for a class"""
        class_id = request.query_params.get('class_id')
        if not class_id:
            return Response(
                {'detail': 'class_id query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        avg_rating = ReviewService.get_average_rating(class_id)
        return Response({'average_rating': avg_rating})

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Class
from .serializers import ClassSerializer, ClassCreateUpdateSerializer
from .services import ClassService


class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'tutor']
    search_fields = ['subject_name', 'address_teaching']
    ordering_fields = ['created_at', 'salary_per_month']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ClassCreateUpdateSerializer
        return ClassSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_classes(self, request):
        """Get classes created by current user"""
        classes = Class.objects.filter(created_by=request.user)
        serializer = self.get_serializer(classes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def assign_tutor(self, request, pk=None):
        """Assign a tutor to a class"""
        cls = self.get_object()
        tutor_id = request.data.get('tutor_id')
        
        try:
            cls = ClassService.assign_tutor(cls, tutor_id)
            serializer = self.get_serializer(cls)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def change_status(self, request, pk=None):
        """Change class status"""
        cls = self.get_object()
        new_status = request.data.get('status')
        
        cls = ClassService.change_status(cls, new_status)
        serializer = self.get_serializer(cls)
        return Response(serializer.data)

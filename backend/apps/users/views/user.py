from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import User
from ..serializers import UserCreateSerializer, UserSerializer
from ..services import UserService


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        permission_classes = [AllowAny]
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        service = UserService()
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if service.change_password(request.user, old_password, new_password):
            return Response({'detail': 'Password changed successfully.'})
        return Response(
            {'detail': 'Old password is incorrect.'},
            status=status.HTTP_400_BAD_REQUEST
        )

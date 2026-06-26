from django.db import IntegrityError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import User, Tutor, Student
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

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        user = request.user
        if request.method == 'PATCH':
            full_name = (request.data.get('fullName') or request.data.get('full_name') or '').strip()
            email = request.data.get('email')
            phone = request.data.get('phone')
            address = request.data.get('address')
            password = request.data.get('password')

            if full_name:
                parts = full_name.split(' ', 1)
                user.first_name = parts[0]
                user.last_name = parts[1] if len(parts) > 1 else ''
            if email is not None:
                user.email = email
            if phone is not None:
                user.phone = phone or None
            if password:
                if len(password) < 6:
                    return Response({'detail': 'Mật khẩu mới phải có ít nhất 6 ký tự.'}, status=status.HTTP_400_BAD_REQUEST)
                user.set_password(password)
            try:
                user.save()
            except IntegrityError:
                return Response({'detail': 'Email hoặc số điện thoại đã được sử dụng.'}, status=status.HTTP_400_BAD_REQUEST)

            if user.role == 'tutor':
                try:
                    tutor = user.tutor_profile
                    if full_name:
                        tutor.full_name = full_name
                    if address is not None:
                        tutor.address = address
                    if full_name or address is not None:
                        tutor.save(update_fields=['full_name', 'address', 'updated_at'])
                except Tutor.DoesNotExist:
                    pass
            elif user.role == 'student':
                try:
                    student = user.student_profile
                    if full_name:
                        student.full_name = full_name
                    if address is not None:
                        student.address = address
                    if full_name or address is not None:
                        student.save(update_fields=['full_name', 'address', 'updated_at'])
                except Student.DoesNotExist:
                    pass

        serializer = self.get_serializer(user)
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

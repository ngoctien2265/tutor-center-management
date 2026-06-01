from rest_framework import serializers

from ..models import Student
from .parent import ParentSerializer
from .user import UserSerializer


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    parent = ParentSerializer(read_only=True)

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    # Giao diện dùng dạng "Lớp 10", "Lớp 11" nên để CharField tự do thay vì bó cứng choices G10/G11.
    grade_level = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Student
        fields = ['full_name', 'gender', 'birthday', 'grade_level', 'school_name', 'note', 'parent']

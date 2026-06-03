from rest_framework import serializers

from ..models import Student
from .user import UserSerializer


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    grade_level = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Student
        fields = [
            'user', 'full_name', 'gender', 'birthday', 'grade_level', 'school_name',
            'parent_name', 'parent_phone', 'parent_email', 'address', 'note'
        ]

from rest_framework import serializers
from .models import Enrollment, Transaction
from apps.classes.serializers import ClassSerializer
from apps.users.serializers import StudentSerializer, ParentSerializer, UserSerializer


class EnrollmentSerializer(serializers.ModelSerializer):
    class_id = ClassSerializer(read_only=True)
    student_id = StudentSerializer(read_only=True)
    parent_id = ParentSerializer(read_only=True)
    
    class Meta:
        model = Enrollment
        fields = '__all__'
        read_only_fields = ['id', 'enrolled_at', 'updated_at']


class EnrollmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ['class_id', 'student_id', 'parent_id', 'status']


class TransactionSerializer(serializers.ModelSerializer):
    user_id = UserSerializer(read_only=True)
    enrollment_id = EnrollmentSerializer(read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class TransactionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['user_id', 'enrollment_id', 'amount', 'type', 'status']

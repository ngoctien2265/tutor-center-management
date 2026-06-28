from django.db import transaction
from rest_framework import serializers

from ..models import Student, Tutor, User


class BaseRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return attrs

    def create_user(self, attrs, role):
        password = attrs.pop('password')
        attrs.pop('password_confirm', None)
        user = User.objects.create_user(role=role, **attrs)
        user.set_password(password)
        user.save()
        return user


class TutorRegisterSerializer(BaseRegisterSerializer):
    fullName = serializers.CharField(max_length=255)
    gender = serializers.CharField(max_length=10, required=False, allow_blank=True, allow_null=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    university = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    major = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    experienceSummary = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    @transaction.atomic
    def create(self, validated_data):
        profile_data = {
            'full_name': validated_data.pop('fullName'),
            'gender': validated_data.pop('gender', None) or None,
            'birthday': validated_data.pop('birthday', None),
            'address': validated_data.pop('address', None) or None,
            'university': validated_data.pop('university', None) or None,
            'major': validated_data.pop('major', None) or None,
            'experience_summary': validated_data.pop('experienceSummary', None) or None,
        }
        user = self.create_user(validated_data, 'tutor')
        user.status = 'inactive'
        user.is_active = True
        user.save(update_fields=['status', 'is_active'])
        tutor = Tutor.objects.create(user=user, is_verified=False, **profile_data)
        return {'user': user, 'tutor': tutor}

    def to_representation(self, instance):
        user = instance['user']
        tutor = instance['tutor']
        return {
            'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role},
            'tutor': {'id': tutor.id, 'fullName': tutor.full_name, 'isVerified': tutor.is_verified},
        }


class StaffRegisterSerializer(BaseRegisterSerializer):
    fullName = serializers.CharField(max_length=255, required=False, allow_blank=True)

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('fullName', None)
        user = self.create_user(validated_data, 'staff')
        user.status = 'inactive'
        user.is_active = True
        user.save(update_fields=['status', 'is_active'])
        return {'user': user}

    def to_representation(self, instance):
        user = instance['user']
        return {
            'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role},
        }


class StudentRegisterSerializer(BaseRegisterSerializer):
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fullName = serializers.CharField(max_length=255)
    gender = serializers.CharField(max_length=10, required=False, allow_blank=True, allow_null=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    gradeLevel = serializers.CharField(max_length=10, required=False, allow_blank=True, allow_null=True)
    schoolName = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    @transaction.atomic
    def create(self, validated_data):
        address = validated_data.pop('address', None) or None

        student_data = {
            'full_name': validated_data.pop('fullName'),
            'gender': validated_data.pop('gender', None) or None,
            'birthday': validated_data.pop('birthday', None),
            'grade_level': validated_data.pop('gradeLevel', None) or None,
            'school_name': validated_data.pop('schoolName', None) or None,
            'note': validated_data.pop('note', None) or None,
            'address': address,
        }

        user = self.create_user(validated_data, 'student')
        user.status = 'active'
        user.is_active = True
        user.save(update_fields=['status', 'is_active'])

        student = Student.objects.create(user=user, **student_data)
        return {'user': user, 'student': student}

    def to_representation(self, instance):
        user = instance['user']
        student = instance['student']
        return {
            'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role},
            'student': {'id': student.id, 'fullName': student.full_name, 'gradeLevel': student.grade_level},
        }

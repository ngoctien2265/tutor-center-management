from rest_framework import serializers

from ..models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'display_name', 'full_name', 'email', 'phone', 'address',
            'role', 'status', 'is_active', 'date_joined', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'date_joined', 'created_at', 'updated_at']

    def _profile_name(self, obj):
        if obj.role == 'tutor' and hasattr(obj, 'tutor_profile'):
            return obj.tutor_profile.full_name
        if obj.role == 'student' and hasattr(obj, 'student_profile'):
            return obj.student_profile.full_name
        return obj.get_full_name() or obj.first_name or obj.username

    def get_display_name(self, obj):
        return self._profile_name(obj)

    def get_full_name(self, obj):
        return self._profile_name(obj)

    def get_address(self, obj):
        if obj.role == 'tutor' and hasattr(obj, 'tutor_profile'):
            return obj.tutor_profile.address
        if obj.role == 'student' and hasattr(obj, 'student_profile'):
            return obj.student_profile.address
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'phone', 'password', 'password_confirm', 'role']

    def validate(self, data):
        if data['password'] != data.pop('password_confirm'):
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

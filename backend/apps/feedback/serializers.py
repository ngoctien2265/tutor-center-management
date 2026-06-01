from rest_framework import serializers
from .models import Review
from apps.classes.serializers import ClassSerializer
from apps.users.serializers import UserSerializer


class ReviewSerializer(serializers.ModelSerializer):
    class_id = ClassSerializer(read_only=True)
    user_id = UserSerializer(read_only=True)
    
    class Meta:
        model = Review
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReviewCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['class_id', 'star_rating', 'comment']

from django.db.models import Avg
from .models import Review


class ReviewService:
    @staticmethod
    def get_reviews_for_class(class_obj):
        """Get all reviews for a class"""
        return Review.objects.filter(class_id=class_obj).order_by('-created_at')

    @staticmethod
    def get_average_rating(class_id):
        """Get average rating for a class"""
        avg = Review.objects.filter(class_id=class_id).aggregate(Avg('star_rating'))['star_rating__avg']
        return round(avg, 2) if avg else 0.0

    @staticmethod
    def get_user_reviews(user):
        """Get all reviews given by a user"""
        return Review.objects.filter(user_id=user).order_by('-created_at')

    @staticmethod
    def update_tutor_rating(class_obj):
        """Update tutor rating based on class reviews"""
        if class_obj.tutor:
            avg_rating = ReviewService.get_average_rating(class_obj.id)
            class_obj.tutor.rating = avg_rating
            class_obj.tutor.save()

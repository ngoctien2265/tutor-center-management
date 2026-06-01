from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.classes.models import Class
from apps.users.models import User


class Review(models.Model):
    class_id = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='reviews')
    user_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    star_rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['class_id', 'user_id']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['class_id', 'star_rating']),
            models.Index(fields=['user_id']),
        ]

    def __str__(self):
        return f"{self.user_id.username} - {self.class_id.subject_name} ({self.star_rating}★)"

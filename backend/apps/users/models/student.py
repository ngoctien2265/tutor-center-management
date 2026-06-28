from django.db import models

from ..choices import GENDER_CHOICES, STUDENT_GRADE_CHOICES
from .user import User


class Student(models.Model):
    GRADE_CHOICES = STUDENT_GRADE_CHOICES

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=255)
    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        blank=True,
        null=True
    )
    birthday = models.DateField(blank=True, null=True)
    grade_level = models.CharField(max_length=10, choices=STUDENT_GRADE_CHOICES, blank=True, null=True)
    school_name = models.CharField(max_length=255, blank=True, null=True)

    address = models.TextField(blank=True, null=True)

    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['grade_level']),
        ]

    def __str__(self):
        return f"{self.full_name} (Student - {self.grade_level})"

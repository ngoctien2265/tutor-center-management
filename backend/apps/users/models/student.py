from django.db import models

from ..choices import GENDER_CHOICES, STUDENT_GRADE_CHOICES
from .parent import Parent
from .user import User


class Student(models.Model):
    GRADE_CHOICES = STUDENT_GRADE_CHOICES

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile', blank=True, null=True)
    parent = models.ForeignKey(Parent, on_delete=models.CASCADE, related_name='students')
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
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['parent', 'grade_level']),
        ]

    def __str__(self):
        return f"{self.full_name} (Student - {self.grade_level})"

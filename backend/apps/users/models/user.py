from django.contrib.auth.models import AbstractUser
from django.db import models

from ..choices import USER_ROLE_CHOICES, USER_STATUS_CHOICES


class User(AbstractUser):
    ROLE_CHOICES = USER_ROLE_CHOICES
    STATUS_CHOICES = USER_STATUS_CHOICES

    role = models.CharField(max_length=20, choices=USER_ROLE_CHOICES)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, blank=True, null=True)
    status = models.CharField(max_length=20, choices=USER_STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['role', 'status']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"

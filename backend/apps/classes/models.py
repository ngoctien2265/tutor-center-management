from django.db import models
from apps.users.models import Tutor, User


class Class(models.Model):
    STATUS_CHOICES = (
        ('completed', 'Hoàn thành'),
        ('cancelled', 'Đã hủy'),
        ('teaching', 'Đang dạy'),
        ('open', 'Đang tìm gia sư'),
        ('waiting_student', 'Đang chờ học viên'),
    )
    
    tutor = models.ForeignKey(Tutor, on_delete=models.SET_NULL, null=True, blank=True, related_name='classes_teaching')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='classes_created')
    subject_name = models.CharField(max_length=255)
    grade_level = models.CharField(max_length=50, blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    schedule_detail = models.TextField(blank=True, null=True)
    sessions_per_week = models.PositiveIntegerField(default=1)
    total_sessions = models.PositiveIntegerField(null=True, blank=True)
    salary_per_month = models.DecimalField(max_digits=10, decimal_places=2)
    tuition_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    address_teaching = models.TextField(blank=True, null=True)
    requirements = models.TextField(blank=True, null=True)
    admin_note = models.TextField(blank=True, null=True)
    teaching_mode = models.CharField(max_length=10, choices=(('online', 'Online'), ('offline', 'Offline')), default='offline')
    expected_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'tutor']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.subject_name} - {self.status}"

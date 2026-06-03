from django.db import models
from apps.classes.models import Class
from apps.users.models import User, Student


class Enrollment(models.Model):
    STATUS_CHOICES = (
        ('unpaid', 'Chưa thanh toán'),
        ('paid', 'Đã thanh toán'),
        ('overdue', 'Quá hạn'),
        ('active', 'Đang học'),
        ('dropped', 'Đã dừng'),
        ('completed', 'Hoàn thành'),
    )

    class_id = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='enrollments')
    student_id = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['class_id', 'student_id']
        ordering = ['-enrolled_at']
        indexes = [
            models.Index(fields=['status', 'class_id']),
            models.Index(fields=['student_id']),
        ]

    def __str__(self):
        return f"{self.student_id.full_name} - {self.class_id.subject_name} ({self.status})"


class Transaction(models.Model):
    TYPE_CHOICES = (
        ('tuition_fee', 'Học phí'),
        ('tutor_salary', 'Lương gia sư'),
        ('commission', 'Hoa hồng trung tâm'),
        ('refund', 'Hoàn tiền'),
    )

    STATUS_CHOICES = (
        ('pending', 'Chờ xác nhận'),
        ('success', 'Đã thanh toán'),
        ('failed', 'Thất bại'),
    )

    user_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    enrollment_id = models.ForeignKey(Enrollment, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type', 'status']),
            models.Index(fields=['user_id']),
        ]

    def __str__(self):
        return f"{self.user_id.username} - {self.amount} ({self.type})"

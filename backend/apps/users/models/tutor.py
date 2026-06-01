from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from ..choices import GENDER_CHOICES
from .user import User


class Tutor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tutor_profile')
    full_name = models.CharField(max_length=255)
    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        blank=True,
        null=True
    )
    birthday = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    university = models.CharField(max_length=255, blank=True, null=True)
    major = models.CharField(max_length=255, blank=True, null=True)
    teachable_subjects = models.TextField(blank=True, null=True)
    teachable_grades = models.TextField(blank=True, null=True)
    teaching_areas = models.TextField(blank=True, null=True)
    experience_summary = models.TextField(blank=True, null=True)
    rating = models.FloatField(default=0.0, validators=[MinValueValidator(0.0), MaxValueValidator(5.0)])
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rating']
        indexes = [
            models.Index(fields=['is_verified', 'rating']),
        ]

    def __str__(self):
        return f"{self.full_name} (Tutor)"


class TutorQualification(models.Model):
    DOCUMENT_CHOICES = [
        ('DEGREE', 'Bằng cấp'),
        ('TRANSCRIPT', 'Bảng điểm'),
        ('CERTIFICATE', 'Chứng chỉ'),
    ]
    STATUS_CHOICES = [('PENDING_REVIEW', 'Pending review'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='qualifications')
    document_type = models.CharField(max_length=40, choices=DOCUMENT_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='tutor/qualifications/', blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING_REVIEW')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']


class TutorAvailability(models.Model):
    DAYS = [('MONDAY','Monday'),('TUESDAY','Tuesday'),('WEDNESDAY','Wednesday'),('THURSDAY','Thursday'),('FRIDAY','Friday'),('SATURDAY','Saturday'),('SUNDAY','Sunday')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='availability')
    day_of_week = models.CharField(max_length=20, choices=DAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ['day_of_week', 'start_time']


class ClassApplication(models.Model):
    STATUS_CHOICES = [('PENDING','Pending'),('APPROVED','Approved'),('REJECTED','Rejected'),('CANCELLED','Cancelled')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='applications')
    class_obj = models.ForeignKey('classes.Class', on_delete=models.CASCADE, related_name='tutor_applications')
    cover_note = models.TextField(blank=True, null=True)
    expected_salary = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    available_schedule_note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['tutor', 'class_obj']
        ordering = ['-submitted_at']


class TeachingLog(models.Model):
    UNDERSTANDING = [('GOOD','Tốt'),('BAD','Không tốt')]
    ATTENDANCE = [('PRESENT','Present'),('ABSENT','Absent'),('LATE','Late')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='teaching_logs')
    class_obj = models.ForeignKey('classes.Class', on_delete=models.CASCADE, related_name='teaching_logs')
    session_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    topic = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)
    student_understanding_level = models.CharField(max_length=20, choices=UNDERSTANDING, default='GOOD')
    attendance_status = models.CharField(max_length=20, choices=ATTENDANCE, default='PRESENT')
    homework = models.TextField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-session_date', '-start_time']


class AbsenceRequest(models.Model):
    TYPE_CHOICES = [('ABSENCE_ONLY','Absence only'),('ABSENCE_WITH_MAKEUP','Absence with makeup'),('RESCHEDULE','Reschedule')]
    STATUS_CHOICES = [('PENDING','Pending'),('APPROVED','Approved'),('REJECTED','Rejected'),('CANCELLED','Cancelled')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='absence_requests')
    class_obj = models.ForeignKey('classes.Class', on_delete=models.CASCADE, related_name='absence_requests')
    session_date = models.DateField()
    reason = models.TextField()
    request_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    proposed_makeup_date = models.DateField(blank=True, null=True)
    proposed_start_time = models.TimeField(blank=True, null=True)
    proposed_end_time = models.TimeField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    admin_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class RefundRequest(models.Model):
    STATUS_CHOICES = [('PENDING','Pending'),('APPROVED','Approved'),('REJECTED','Rejected'),('COMPLETED','Completed'),('CANCELLED','Cancelled')]
    tutor = models.ForeignKey(Tutor, on_delete=models.CASCADE, related_name='refund_requests')
    class_obj = models.ForeignKey('classes.Class', on_delete=models.CASCADE, related_name='refund_requests')
    receiving_fee_id = models.CharField(max_length=100, blank=True, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    reason = models.TextField()
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=100)
    account_holder = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    admin_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

from django.contrib import admin
from .models import Enrollment, Transaction


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'class_id', 'status', 'enrolled_at')
    list_filter = ('status', 'enrolled_at')
    search_fields = ('student_id__full_name', 'class_id__subject_name')
    ordering = ('-enrolled_at',)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'amount', 'type', 'status', 'created_at')
    list_filter = ('type', 'status', 'created_at')
    search_fields = ('user_id__username', 'enrollment_id__student_id__full_name')
    ordering = ('-created_at',)

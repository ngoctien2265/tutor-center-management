from django.contrib import admin
from .models import (
    AbsenceRequest,
    ClassApplication,
    Parent,
    RefundRequest,
    Student,
    TeachingLog,
    Tutor,
    TutorAvailability,
    TutorQualification,
    User,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'status', 'created_at')
    list_filter = ('role', 'status', 'created_at')
    search_fields = ('username', 'email', 'phone')
    ordering = ('-created_at',)


@admin.register(Tutor)
class TutorAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'university', 'rating', 'is_verified', 'created_at')
    list_filter = ('is_verified', 'rating', 'created_at')
    search_fields = ('full_name', 'university', 'major')
    ordering = ('-rating',)


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'phone', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('full_name', 'phone')


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'parent', 'grade_level', 'school_name', 'created_at')
    list_filter = ('grade_level', 'created_at')
    search_fields = ('full_name', 'school_name')


admin.site.register(TutorQualification)
admin.site.register(TutorAvailability)
admin.site.register(ClassApplication)
admin.site.register(TeachingLog)
admin.site.register(AbsenceRequest)
admin.site.register(RefundRequest)

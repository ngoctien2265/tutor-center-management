from django.contrib import admin
from .models import Class


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('subject_name', 'tutor', 'status', 'salary_per_month', 'created_at')
    list_filter = ('status', 'created_at', 'tutor')
    search_fields = ('subject_name', 'address_teaching')
    ordering = ('-created_at',)

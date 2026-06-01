from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'class_id', 'star_rating', 'created_at')
    list_filter = ('star_rating', 'created_at')
    search_fields = ('user_id__username', 'class_id__subject_name', 'comment')
    ordering = ('-created_at',)

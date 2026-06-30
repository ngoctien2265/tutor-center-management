from .models import Class
from apps.users.models import Tutor


class ClassService:
    @staticmethod
    def get_open_classes():
        """Get all open classes"""
        return Class.objects.filter(status='open').order_by('-created_at')

    @staticmethod
    def assign_tutor(cls, tutor_id):
        """Assign a tutor to a class"""
        tutor = Tutor.objects.get(id=tutor_id)
        cls.tutor = tutor
        cls.status = 'teaching' if cls.enrollments.exists() else 'waiting_student'
        cls.save()
        return cls

    @staticmethod
    def change_status(cls, new_status):
        """Change class status"""
        valid_statuses = [choice[0] for choice in Class._meta.get_field('status').choices]
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status: {new_status}")
        cls.status = new_status
        cls.save()
        return cls

    @staticmethod
    def get_classes_by_tutor(tutor):
        """Get all classes taught by a tutor"""
        return Class.objects.filter(tutor=tutor).order_by('-created_at')

    @staticmethod
    def get_classes_by_status(status):
        """Get classes by status"""
        return Class.objects.filter(status=status).order_by('-created_at')

from ..models import Student


class StudentService:
    @staticmethod
    def get_students_by_user(user):
        """Get students associated with a user (student role)."""
        if hasattr(user, 'student_profile'):
            return Student.objects.filter(pk=user.student_profile.pk)
        return Student.objects.none()

    @staticmethod
    def create_student(validated_data):
        return Student.objects.create(**validated_data)

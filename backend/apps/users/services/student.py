from ..models import Student


class StudentService:
    @staticmethod
    def get_students_by_parent(parent):
        return parent.students.all()

    @staticmethod
    def create_student(parent, validated_data):
        return Student.objects.create(parent=parent, **validated_data)

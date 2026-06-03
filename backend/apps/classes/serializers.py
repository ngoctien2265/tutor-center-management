from rest_framework import serializers
from .models import Class
from apps.users.models import Tutor
from apps.users.serializers import TutorSerializer, UserSerializer


class ClassSerializer(serializers.ModelSerializer):
    tutor = TutorSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    student = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    enrollment_id = serializers.SerializerMethodField()
    tutor_id = serializers.PrimaryKeyRelatedField(
        queryset=Tutor.objects.all(),
        source='tutor',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Class
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def _enrollment(self, obj):
        try:
            return obj.enrollments.select_related('student_id').first()
        except Exception:
            return None

    def get_enrollment_id(self, obj):
        enrollment = self._enrollment(obj)
        return enrollment.id if enrollment else None

    def get_student(self, obj):
        enrollment = self._enrollment(obj)
        if not enrollment or not enrollment.student_id:
            return None
        student = enrollment.student_id
        return {
            'id': student.id,
            'full_name': student.full_name,
            'fullName': student.full_name,
            'grade_level': student.grade_level,
            'gradeLevel': student.grade_level,
            'school_name': student.school_name,
        }

    def get_parent(self, obj):
        enrollment = self._enrollment(obj)
        student = enrollment.student_id if enrollment else None
        if not student:
            return None
        return {
            'id': student.id,
            'full_name': student.parent_name or student.full_name,
            'fullName': student.parent_name or student.full_name,
            'phone': student.parent_phone or '',
            'email': student.parent_email or '',
            'address': student.address or '',
        }


class ClassCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = [
            'subject_name', 'grade_level', 'schedule_detail', 'sessions_per_week',
            'salary_per_month', 'tuition_fee', 'address_teaching', 'requirements', 'admin_note',
            'teaching_mode', 'expected_hourly_rate', 'status', 'tutor',
            'start_date'

        ]

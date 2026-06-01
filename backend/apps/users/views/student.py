from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import Student
from ..serializers import StudentCreateUpdateSerializer, StudentSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['parent', 'grade_level']
    search_fields = ['full_name', 'school_name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        return StudentSerializer

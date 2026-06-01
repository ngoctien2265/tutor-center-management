from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..serializers import StaffRegisterSerializer, StudentRegisterSerializer, TutorRegisterSerializer


def created(serializer):
    serializer.is_valid(raise_exception=True)
    instance = serializer.save()
    return Response({'success': True, 'data': serializer.to_representation(instance)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_student(request):
    return created(StudentRegisterSerializer(data=request.data))


@api_view(['POST'])
@permission_classes([AllowAny])
def register_tutor(request):
    return created(TutorRegisterSerializer(data=request.data))


@api_view(['POST'])
@permission_classes([AllowAny])
def register_staff(request):
    return created(StaffRegisterSerializer(data=request.data))

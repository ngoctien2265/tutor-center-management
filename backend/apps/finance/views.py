from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Enrollment, Transaction
from .serializers import (
    EnrollmentSerializer, EnrollmentCreateUpdateSerializer,
    TransactionSerializer, TransactionCreateUpdateSerializer
)
from .services import EnrollmentService, TransactionService


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'class_id', 'student_id', 'parent_id']
    ordering_fields = ['enrolled_at', 'status']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EnrollmentCreateUpdateSerializer
        return EnrollmentSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def change_status(self, request, pk=None):
        """Change enrollment status"""
        enrollment = self.get_object()
        new_status = request.data.get('status')
        
        enrollment = EnrollmentService.change_status(enrollment, new_status)
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'status', 'user_id']
    ordering_fields = ['created_at', 'amount']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TransactionCreateUpdateSerializer
        return TransactionSerializer

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_transactions(self, request):
        """Get transactions of current user"""
        transactions = Transaction.objects.filter(user_id=request.user)
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_success(self, request, pk=None):
        """Mark transaction as successful"""
        transaction = self.get_object()
        transaction = TransactionService.mark_success(transaction)
        serializer = self.get_serializer(transaction)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_failed(self, request, pk=None):
        """Mark transaction as failed"""
        transaction = self.get_object()
        transaction = TransactionService.mark_failed(transaction)
        serializer = self.get_serializer(transaction)
        return Response(serializer.data)

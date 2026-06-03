from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from .models import Enrollment, Transaction
from .serializers import (
    EnrollmentSerializer, EnrollmentCreateUpdateSerializer,
    TransactionSerializer, TransactionCreateUpdateSerializer
)
from .services import EnrollmentService, TransactionService


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related('class_id', 'student_id').all()
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'class_id', 'student_id']
    ordering_fields = ['enrolled_at', 'status']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EnrollmentCreateUpdateSerializer
        return EnrollmentSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def change_status(self, request, pk=None):
        """Change enrollment status"""
        enrollment = self.get_object()
        new_status = request.data.get('status')

        enrollment = EnrollmentService.change_status(enrollment, new_status)
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def payment_status_by_class(self, request):
        """Get payment status grouped by class"""
        enrollments = self.get_queryset()
        class_stats = {}

        for enrollment in enrollments:
            class_name = enrollment.class_id.subject_name if enrollment.class_id else 'N/A'
            if class_name not in class_stats:
                class_stats[class_name] = {
                    'className': class_name,
                    'paid': 0,
                    'unpaid': 0,
                    'total': 0,
                    'totalFee': 0
                }

            class_stats[class_name]['total'] += 1
            if enrollment.class_id:
                class_stats[class_name]['totalFee'] += float(enrollment.class_id.tuition_fee or 0)

            if enrollment.status in ['paid', 'active']:
                class_stats[class_name]['paid'] += 1
            else:
                class_stats[class_name]['unpaid'] += 1

        return Response(list(class_stats.values()))


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.select_related('user_id', 'enrollment_id', 'enrollment_id__class_id').all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'status', 'user_id']
    ordering_fields = ['created_at', 'amount']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TransactionCreateUpdateSerializer
        return TransactionSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_transactions(self, request):
        """Get transactions of current user"""
        transactions = Transaction.objects.filter(user_id=request.user)
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def tuition_payments(self, request):
        """Get all tuition fee transactions with details"""
        transactions = self.get_queryset().filter(type='tuition_fee').order_by('-created_at')
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

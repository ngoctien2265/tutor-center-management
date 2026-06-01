from .models import Enrollment, Transaction


class EnrollmentService:
    @staticmethod
    def get_enrollments_by_class(class_obj):
        """Get all enrollments for a class"""
        return Enrollment.objects.filter(class_id=class_obj).order_by('-enrolled_at')

    @staticmethod
    def get_enrollments_by_student(student):
        """Get all enrollments for a student"""
        return Enrollment.objects.filter(student_id=student).order_by('-enrolled_at')

    @staticmethod
    def change_status(enrollment, new_status):
        """Change enrollment status"""
        valid_statuses = [choice[0] for choice in Enrollment._meta.get_field('status').choices]
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status: {new_status}")
        enrollment.status = new_status
        enrollment.save()
        return enrollment

    @staticmethod
    def get_active_enrollments():
        """Get all active enrollments"""
        return Enrollment.objects.filter(status='active').order_by('-enrolled_at')


class TransactionService:
    @staticmethod
    def get_user_transactions(user):
        """Get all transactions for a user"""
        return Transaction.objects.filter(user_id=user).order_by('-created_at')

    @staticmethod
    def get_transactions_by_type(transaction_type):
        """Get transactions by type"""
        return Transaction.objects.filter(type=transaction_type).order_by('-created_at')

    @staticmethod
    def mark_success(transaction):
        """Mark transaction as successful"""
        transaction.status = 'success'
        transaction.save()
        return transaction

    @staticmethod
    def mark_failed(transaction):
        """Mark transaction as failed"""
        transaction.status = 'failed'
        transaction.save()
        return transaction

    @staticmethod
    def get_pending_transactions():
        """Get all pending transactions"""
        return Transaction.objects.filter(status='pending').order_by('-created_at')

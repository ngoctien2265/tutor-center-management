from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone

from ..models import Tutor
from apps.classes.models import Class
from apps.finance.models import Transaction
from apps.feedback.models import Review
from apps.users.models import (
    AbsenceRequest,
    ClassApplication,
    RefundRequest,
    TeachingLog,
    TutorAvailability,
    TutorQualification,
)
from apps.users.serializers.tutor import parse_schedule_text


class TutorService:
    @staticmethod
    def get_verified_tutors():
        return Tutor.objects.filter(is_verified=True).order_by('-rating')

    @staticmethod
    def update_rating(tutor, new_rating):
        tutor.rating = new_rating
        tutor.save()
        return tutor

    @staticmethod
    def verify_tutor(tutor):
        tutor.is_verified = True
        tutor.save()
        return tutor

    @staticmethod
    def get_tutor_for_user(user):
        if getattr(user, 'role', None) != 'tutor':
            return None
        try:
            return user.tutor_profile
        except Tutor.DoesNotExist:
            return None

    @staticmethod
    def get_dashboard(tutor):
        active_qs = Class.objects.filter(tutor=tutor, status__in=['waiting_parent', 'waiting_tutor', 'assigned', 'teaching', 'paused', 'completed', 'cancelled'])
        upcoming = []
        for class_obj in active_qs.filter(status__in=['assigned', 'waiting_parent', 'waiting_tutor', 'teaching'])[:5]:
            slot = (parse_schedule_text(class_obj.schedule_detail) or [{}])[0]
            upcoming.append({
                'classId': class_obj.id,
                'subject': class_obj.subject_name,
                'date': None,
                'dayOfWeek': slot.get('dayOfWeek'),
                'dayLabel': slot.get('dayLabel'),
                'startTime': slot.get('startTime', '18:00'),
                'endTime': slot.get('endTime', '19:30'),
            })
        return {
            'activeClasses': active_qs.filter(status__in=['assigned', 'waiting_parent', 'waiting_tutor', 'teaching']).count(),
            'pendingApplications': tutor.applications.filter(status='PENDING').count(),
            'approvedApplications': tutor.applications.filter(status='APPROVED').count(),
            'pendingAbsenceRequests': tutor.absence_requests.filter(status='PENDING', request_type='ABSENCE_ONLY').count(),
            'pendingMakeupRequests': tutor.absence_requests.filter(status='PENDING', request_type='RESCHEDULE').count(),
            'totalTeachingLogs': tutor.teaching_logs.count(),
            'totalReviews': Review.objects.filter(class_id__tutor=tutor).count(),
            'upcomingSessions': upcoming,
        }

    @staticmethod
    def get_qualifications(tutor, filters):
        qs = TutorQualification.objects.filter(tutor=tutor)
        if filters.get('documentType'):
            qs = qs.filter(document_type=filters['documentType'])
        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        return qs

    @staticmethod
    def get_qualification(tutor, document_id):
        return TutorQualification.objects.get(pk=document_id, tutor=tutor)

    @staticmethod
    def save_serializer(serializer, **kwargs):
        serializer.is_valid(raise_exception=True)
        return serializer.save(**kwargs)

    @staticmethod
    def delete_object(obj):
        obj.delete()

    @staticmethod
    def replace_availability(tutor, availability_items):
        TutorAvailability.objects.filter(tutor=tutor).delete()
        for item in availability_items:
            TutorAvailability.objects.create(
                tutor=tutor,
                day_of_week=item.get('dayOfWeek'),
                start_time=item.get('startTime'),
                end_time=item.get('EndTime') or item.get('endTime'),
            )

    @staticmethod
    def check_schedule_conflicts(tutor, day, start, end):
        conflicts = []
        for class_obj in Class.objects.filter(tutor=tutor, status__in=['assigned', 'waiting_tutor', 'teaching']):
            for slot in parse_schedule_text(class_obj.schedule_detail):
                if slot.get('dayOfWeek') != day:
                    continue
                if start and end and not (end <= slot['startTime'] or start >= slot['endTime']):
                    conflicts.append({'classId': class_obj.id, 'subject': class_obj.subject_name, 'schedule': slot})
        return conflicts

    @staticmethod
    def get_open_classes(filters, tutor=None):
        qs = Class.objects.filter(status='open')
        search = filters.get('search')
        subject = filters.get('subject')
        if search:
            qs = qs.filter(Q(subject_name__icontains=search) | Q(address_teaching__icontains=search) | Q(requirements__icontains=search))
        if subject:
            qs = qs.filter(subject_name__icontains=subject)
        if filters.get('minSalary'):
            qs = qs.filter(salary_per_month__gte=filters['minSalary'])
        if filters.get('maxSalary'):
            qs = qs.filter(salary_per_month__lte=filters['maxSalary'])
        qs = qs.order_by('-created_at')
        if not tutor:
            return qs
        classes = list(qs)
        active_classes = list(Class.objects.filter(tutor=tutor, status__in=['assigned', 'waiting_tutor', 'teaching']))
        subjects = TutorService._tokens(tutor.teachable_subjects)
        grades = TutorService._tokens(tutor.teachable_grades)
        areas = TutorService._tokens(tutor.teaching_areas)

        def score(class_obj):
            text = f'{class_obj.subject_name} {class_obj.requirements or ""} {class_obj.address_teaching or ""}'.lower()
            value = 0
            if subjects and any(token in text for token in subjects):
                value += 30
            if grades and any(token in text for token in grades):
                value += 20
            if areas and any(token in text for token in areas):
                value += 20
            if TutorService._has_overlap(class_obj, active_classes):
                value -= 50
            return value

        classes.sort(key=score, reverse=True)
        return classes

    @staticmethod
    def _tokens(value):
        import re
        return [token.strip().lower() for token in re.split(r'[,;\n]+', value or '') if token.strip()]

    @staticmethod
    def _has_overlap(class_obj, active_classes):
        for new_slot in parse_schedule_text(class_obj.schedule_detail):
            for active_class in active_classes:
                for old_slot in parse_schedule_text(active_class.schedule_detail):
                    if new_slot.get('dayOfWeek') == old_slot.get('dayOfWeek') and not (new_slot['endTime'] <= old_slot['startTime'] or new_slot['startTime'] >= old_slot['endTime']):
                        return True
        return False

    @staticmethod
    def get_open_class(class_id):
        return Class.objects.get(pk=class_id, status='open')

    @staticmethod
    def apply_class(tutor, class_id, data, default_salary):
        class_obj = Class.objects.get(pk=class_id, status='open')
        for new_slot in parse_schedule_text(class_obj.schedule_detail):
            for teaching_class in Class.objects.filter(tutor=tutor, status__in=['assigned', 'waiting_tutor', 'teaching']):
                for old_slot in parse_schedule_text(teaching_class.schedule_detail):
                    overlap = new_slot.get('dayOfWeek') == old_slot.get('dayOfWeek') and not (new_slot['endTime'] <= old_slot['startTime'] or new_slot['startTime'] >= old_slot['endTime'])
                    if overlap:
                        return None, class_obj, f'Lịch lớp này trùng với lớp đang dạy: {teaching_class.subject_name}.'
        existing = ClassApplication.objects.filter(tutor=tutor, class_obj=class_obj).exclude(status='CANCELLED').first()
        if existing:
            # Nếu nhân viên đã gửi lời mời trước đó thì gia sư bấm Đồng ý vẫn coi là hợp lệ,
            # giữ trạng thái PENDING để nhân viên duyệt/phân công ở màn Phân công gia sư.
            return existing, class_obj, None
        expected_salary = data.get('expectedSalary') or default_salary
        old_cancelled = ClassApplication.objects.filter(tutor=tutor, class_obj=class_obj, status='CANCELLED').first()
        if old_cancelled:
            old_cancelled.cover_note = data.get('coverNote', '')
            old_cancelled.expected_salary = expected_salary or None
            old_cancelled.available_schedule_note = data.get('availableScheduleNote', '')
            old_cancelled.status = 'PENDING'
            old_cancelled.reviewed_at = None
            old_cancelled.rejection_reason = None
            old_cancelled.save()
            return old_cancelled, class_obj, None
        try:
            application = ClassApplication.objects.create(
                tutor=tutor,
                class_obj=class_obj,
                cover_note=data.get('coverNote', ''),
                expected_salary=expected_salary or None,
                available_schedule_note=data.get('availableScheduleNote', ''),
            )
        except IntegrityError:
            return None, class_obj, 'Bạn đã đăng ký lớp này rồi.'
        return application, class_obj, None

    @staticmethod
    def get_applications(tutor, filters):
        qs = tutor.applications.all()
        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        if filters.get('fromDate'):
            qs = qs.filter(submitted_at__date__gte=filters['fromDate'])
        if filters.get('toDate'):
            qs = qs.filter(submitted_at__date__lte=filters['toDate'])
        return qs

    @staticmethod
    def get_application(tutor, application_id):
        return ClassApplication.objects.get(pk=application_id, tutor=tutor)

    @staticmethod
    def cancel_application(application):
        application.status = 'CANCELLED'
        application.reviewed_at = timezone.now()
        application.save(update_fields=['status', 'reviewed_at'])

    @staticmethod
    def get_active_classes(tutor, filters):
        qs = Class.objects.filter(tutor=tutor)
        if filters.get('status'):
            return qs.filter(status=filters['status'].lower())
        return qs.filter(status__in=['waiting_parent', 'waiting_tutor', 'assigned', 'teaching', 'paused', 'completed', 'cancelled'])

    @staticmethod
    def get_teaching_class(tutor, class_id):
        return Class.objects.get(pk=class_id, tutor=tutor)

    @staticmethod
    def get_timetable(tutor):
        timetable = []
        for class_obj in Class.objects.filter(tutor=tutor, status__in=['assigned', 'waiting_parent', 'waiting_tutor', 'teaching']).order_by('subject_name'):
            for slot in parse_schedule_text(class_obj.schedule_detail):
                timetable.append({
                    'classId': class_obj.id,
                    'subject': class_obj.subject_name,
                    'date': None,
                    'dayOfWeek': slot.get('dayOfWeek'),
                    'dayLabel': slot.get('dayLabel'),
                    'startTime': slot.get('startTime', '18:00'),
                    'endTime': slot.get('endTime', '19:30'),
                    'location': class_obj.address_teaching,
                    'status': class_obj.status.upper(),
                    'sessionsPerWeek': class_obj.sessions_per_week,
                    'salaryPerMonth': class_obj.salary_per_month,
                })
        return timetable

    @staticmethod
    def get_teaching_logs(tutor, class_id):
        class_obj = Class.objects.get(pk=class_id, tutor=tutor)
        return class_obj, class_obj.teaching_logs.filter(tutor=tutor)

    @staticmethod
    def get_teaching_log(tutor, log_id):
        return TeachingLog.objects.get(pk=log_id, tutor=tutor)

    @staticmethod
    def create_teaching_log(tutor, class_obj, serializer):
        return TutorService.save_serializer(serializer, tutor=tutor, class_obj=class_obj)

    @staticmethod
    def update_teaching_log(serializer):
        return TutorService.save_serializer(serializer)

    @staticmethod
    def create_absence_requests(tutor, class_id, data, serializer_class):
        class_obj = Class.objects.get(pk=class_id, tutor=tutor)
        req_type = data.get('requestType') or data.get('request_type') or 'ABSENCE_ONLY'
        reason = data.get('reason') or ''
        if req_type == 'ABSENCE_ONLY':
            dates = data.get('absentDates') or [data.get('sessionDate')]
            dates = [date for date in dates if date]
            if not dates:
                return None, 'Vui lòng chọn ngày nghỉ.'
            if len(dates) > 2:
                return None, 'Mỗi lần chỉ được gửi tối đa 2 buổi nghỉ.'
            created = []
            for date in dates:
                serializer = serializer_class(data={'sessionDate': date, 'reason': reason, 'requestType': 'ABSENCE_ONLY'})
                serializer.is_valid(raise_exception=True)
                created.append(serializer.save(tutor=tutor, class_obj=class_obj))
            first = created[0]
            return {'requestId': first.id, 'status': first.status, 'count': len(created)}, None
        serializer = serializer_class(data=data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(tutor=tutor, class_obj=class_obj)
        return {'requestId': obj.id, 'status': obj.status}, None

    @staticmethod
    def get_absence_requests(tutor, filters):
        qs = tutor.absence_requests.all()
        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        if filters.get('classId'):
            qs = qs.filter(class_obj_id=filters['classId'])
        if filters.get('fromDate'):
            qs = qs.filter(session_date__gte=filters['fromDate'])
        if filters.get('toDate'):
            qs = qs.filter(session_date__lte=filters['toDate'])
        return qs

    @staticmethod
    def get_absence_request(tutor, request_id, pending_only=False):
        filters = {'pk': request_id, 'tutor': tutor}
        if pending_only:
            filters['status'] = 'PENDING'
        return AbsenceRequest.objects.get(**filters)

    @staticmethod
    def cancel_absence_request(obj, reason):
        obj.status = 'CANCELLED'
        obj.note = (obj.note or '') + '\nLý do hủy: ' + reason
        obj.save(update_fields=['status', 'note'])

    @staticmethod
    def get_refund_requests(tutor, filters):
        qs = tutor.refund_requests.all()
        if filters.get('status'):
            qs = qs.filter(status=filters['status'])
        if filters.get('classId'):
            qs = qs.filter(class_obj_id=filters['classId'])
        if filters.get('fromDate'):
            qs = qs.filter(created_at__date__gte=filters['fromDate'])
        if filters.get('toDate'):
            qs = qs.filter(created_at__date__lte=filters['toDate'])
        return qs

    @staticmethod
    def create_refund_request(tutor, data):
        class_obj = Class.objects.get(pk=data.get('classId'), tutor=tutor)
        bank = data.get('bankAccount', {})
        return RefundRequest.objects.create(
            tutor=tutor,
            class_obj=class_obj,
            receiving_fee_id=data.get('receivingFeeId'),
            amount=data.get('amount'),
            reason=data.get('reason'),
            bank_name=bank.get('bankName', ''),
            account_number=bank.get('accountNumber', ''),
            account_holder=bank.get('accountHolder', ''),
        )

    @staticmethod
    def get_refund_request(tutor, refund_request_id, pending_only=False):
        filters = {'pk': refund_request_id, 'tutor': tutor}
        if pending_only:
            filters['status'] = 'PENDING'
        return RefundRequest.objects.get(**filters)

    @staticmethod
    def cancel_refund_request(obj, reason):
        obj.status = 'CANCELLED'
        obj.admin_note = 'Gia sư hủy: ' + reason
        obj.save(update_fields=['status', 'admin_note'])

    @staticmethod
    def get_receiving_fees(user):
        return [
            {
                'feeId': transaction.id,
                'classId': transaction.enrollment_id.class_id_id if transaction.enrollment_id else None,
                'amount': transaction.amount,
                'status': transaction.status.upper(),
                'createdAt': transaction.created_at,
            }
            for transaction in Transaction.objects.filter(user_id=user, type='commission')
        ]

    @staticmethod
    def get_receiving_fee(user, fee_id):
        transaction = Transaction.objects.get(pk=fee_id, user_id=user, type='commission')
        return {'feeId': transaction.id, 'amount': transaction.amount, 'status': transaction.status.upper(), 'createdAt': transaction.created_at}

    @staticmethod
    def get_reviews(tutor, filters):
        qs = Review.objects.filter(class_id__tutor=tutor)
        if filters.get('classId'):
            qs = qs.filter(class_id_id=filters['classId'])
        return qs

    @staticmethod
    def get_notifications():
        return {'items': [], 'pagination': {'page': 1, 'limit': 10, 'total': 0}}

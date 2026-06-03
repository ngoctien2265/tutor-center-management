from decimal import Decimal

from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.classes.models import Class
from apps.classes.serializers import ClassSerializer
from apps.feedback.models import Review
from apps.feedback.serializers import ReviewSerializer
from apps.finance.models import Enrollment, Transaction
from apps.finance.serializers import TransactionSerializer
from apps.finance.services import TransactionService
from apps.users.models import Student, AbsenceRequest
from apps.users.serializers import StudentSerializer, StudentCreateUpdateSerializer, UserSerializer
from apps.users.serializers.tutor import parse_schedule_text


def ok(data=None, message=None, code=status.HTTP_200_OK):
    payload = {'success': True}
    if message:
        payload['message'] = message
    if data is not None:
        payload['data'] = data
    return Response(payload, status=code)


def fail(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'message': message}, status=code)


def customer_context(user):
    if getattr(user, 'role', None) == 'student' and hasattr(user, 'student_profile'):
        student = user.student_profile
        return student, [student]
    return None, []


def require_customer(request):
    student, students = customer_context(request.user)
    if not student or not students:
        return None, None, fail('Chỉ tài khoản học viên mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    return student, students, None


def customer_enrollments(student):
    return Enrollment.objects.select_related('class_id', 'class_id__tutor', 'student_id').filter(
        student_id=student,
    ).order_by('-enrolled_at')


def default_monthly_fee(subject='', grade=''):
    text = f'{subject} {grade}'.lower()
    if '12' in text:
        return Decimal('3000000')
    if '11' in text or '10' in text:
        return Decimal('2500000')
    if 'anh' in text:
        return Decimal('2200000')
    return Decimal('2000000')


def ensure_tuition_transaction(enrollment):
    existing = Transaction.objects.filter(enrollment_id=enrollment, type='tuition_fee').order_by('-created_at').first()
    if existing:
        return existing
    cls = enrollment.class_id
    amount = cls.tuition_fee or cls.salary_per_month or default_monthly_fee(cls.subject_name, cls.grade_level)
    user = enrollment.student_id.user
    if not user:
        return None
    return Transaction.objects.create(
        user_id=user,
        enrollment_id=enrollment,
        amount=amount,
        type='tuition_fee',
        status='pending' if enrollment.status in ['unpaid', 'overdue'] else 'success' if enrollment.status == 'paid' else 'pending',
    )


def class_payload(enrollment):
    cls = enrollment.class_id
    tutor = cls.tutor
    absence_items = [
        {
            'requestId': item.id,
            'sessionDate': item.session_date,
            'reason': item.reason,
            'requestType': item.request_type,
            'status': item.status,
            'adminNote': item.admin_note,
            'proposedMakeupDate': item.proposed_makeup_date,
            'proposedStartTime': item.proposed_start_time,
            'proposedEndTime': item.proposed_end_time,
        }
        for item in AbsenceRequest.objects.filter(class_obj=cls).order_by('-created_at')[:10]
    ]
    return {
        'enrollmentId': enrollment.id,
        'classId': cls.id,
        'subject': cls.subject_name,
        'schedule': parse_schedule_text(cls.schedule_detail),
        'scheduleDetail': cls.schedule_detail,
        'sessionsPerWeek': cls.sessions_per_week,
        'salaryPerMonth': cls.tuition_fee or cls.salary_per_month,
        'location': cls.address_teaching,
        'requirements': cls.requirements,
        'absenceRequests': absence_items,
        'status': cls.status.upper(),
        'enrollmentStatus': enrollment.status,
        'needsParentConfirmation': cls.status == 'waiting_parent' and bool(cls.tutor_id),
        'confirmationMessage': 'Nhân viên đã gửi gia sư phù hợp, vui lòng xác nhận để lớp chuyển sang Đang học.' if cls.status == 'waiting_parent' and cls.tutor_id else '',
        'student': StudentSerializer(enrollment.student_id).data,
        'tutor': {
            'id': tutor.id,
            'fullName': tutor.full_name,
            'phone': tutor.user.phone if tutor.user else '',
            'email': tutor.user.email if tutor.user else '',
            'university': tutor.university,
            'major': tutor.major,
            'bio': tutor.experience_summary,
            'rating': tutor.rating,
            'teachableSubjects': tutor.teachable_subjects,
            'teachableGrades': tutor.teachable_grades,
            'teachingAreas': tutor.teaching_areas,
        } if tutor else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    return ok({
        'user': UserSerializer(request.user).data,
        'student': StudentSerializer(student).data,
        'students': StudentSerializer(students, many=True).data,
    })




@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def students_collection(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    if request.method == 'GET':
        return ok(StudentSerializer(students, many=True).data)
    serializer = StudentCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_student = serializer.save()
    return ok(StudentSerializer(new_student).data, 'Đã thêm học viên.', status.HTTP_201_CREATED)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def student_detail(request, student_id):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    try:
        target_student = Student.objects.get(pk=student_id, pk__in=[item.id for item in students])
    except Student.DoesNotExist:
        return fail('Không tìm thấy học viên.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(StudentSerializer(target_student).data)
    if request.method == 'DELETE':
        if Enrollment.objects.filter(student_id=target_student).exists():
            return fail('Không thể xóa học viên đã có lớp học trong hệ thống. Bạn có thể cập nhật thông tin thay vì xóa.')
        target_student.delete()
        return ok(message='Đã xóa học viên.')
    serializer = StudentCreateUpdateSerializer(target_student, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return ok(StudentSerializer(target_student).data, 'Đã cập nhật thông tin học viên.')

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def class_requests(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    student_id = request.data.get('studentId') or request.data.get('student')
    target_student = students[0]
    if student_id:
        matches = [item for item in students if str(item.id) == str(student_id)]
        if not matches:
            return fail('Học viên không thuộc tài khoản hiện tại.', status.HTTP_403_FORBIDDEN)
        target_student = matches[0]
    subject = request.data.get('subject') or request.data.get('subjectName')
    if not subject:
        return fail('Vui lòng nhập môn học cần tìm gia sư.')
    raw_salary = request.data.get('salaryPerMonth') or request.data.get('expectedFee') or request.data.get('tuitionFee')
    salary = Decimal(str(raw_salary)) if raw_salary not in [None, '', 0, '0'] else default_monthly_fee(subject, request.data.get('gradeLevel') or target_student.grade_level)
    cls = Class.objects.create(
        created_by=request.user,
        subject_name=subject,
        grade_level=request.data.get('gradeLevel') or request.data.get('grade_level') or target_student.grade_level or '',
        schedule_detail=request.data.get('scheduleDetail') or request.data.get('desiredSchedule') or '',
        sessions_per_week=request.data.get('sessionsPerWeek') or 1,
        salary_per_month=(salary * Decimal('0.7')).quantize(Decimal('1')),
        tuition_fee=salary,
        address_teaching=request.data.get('area') or request.data.get('location') or target_student.address or '',
        requirements=request.data.get('requirements') or '',
        status='staff_pending',
    )
    enrollment = Enrollment.objects.create(class_id=cls, student_id=target_student, status='unpaid')
    Transaction.objects.create(user_id=request.user, enrollment_id=enrollment, amount=salary, type='tuition_fee', status='pending')
    return ok(class_payload(enrollment), 'Đã gửi nhu cầu tìm gia sư cho trung tâm.', status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def classes(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    return ok([class_payload(enrollment) for enrollment in customer_enrollments(student)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timetable(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    items = []
    for enrollment in customer_enrollments(student).filter(class_id__status__in=['open', 'assigned', 'teaching']):
        cls = enrollment.class_id
        for slot in parse_schedule_text(cls.schedule_detail):
            items.append({
                'classId': cls.id,
                'subject': cls.subject_name,
                'dayOfWeek': slot.get('dayOfWeek'),
                'dayLabel': slot.get('dayLabel'),
                'startTime': slot.get('startTime'),
                'endTime': slot.get('endTime'),
                'location': cls.address_teaching,
                'status': cls.status.upper(),
                'tutorName': cls.tutor.full_name if cls.tutor else '',
            })
    return ok(items)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payments(request):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    enrollments = list(customer_enrollments(student))
    for enrollment in enrollments:
        ensure_tuition_transaction(enrollment)
    enrollment_ids = [enrollment.id for enrollment in enrollments]
    transactions = Transaction.objects.select_related('enrollment_id', 'enrollment_id__class_id').filter(
        enrollment_id__in=enrollment_ids,
        type='tuition_fee',
    ).order_by('-created_at')
    return ok(TransactionSerializer(transactions, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay(request, transaction_id):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    enrollment_ids = customer_enrollments(student).values_list('id', flat=True)
    try:
        transaction = Transaction.objects.get(pk=transaction_id, enrollment_id__in=enrollment_ids, type='tuition_fee')
    except Transaction.DoesNotExist:
        return fail('Không tìm thấy khoản học phí.', status.HTTP_404_NOT_FOUND)
    TransactionService.mark_success(transaction)
    if transaction.enrollment_id and transaction.enrollment_id.status in ['unpaid', 'overdue']:
        transaction.enrollment_id.status = 'paid'
        transaction.enrollment_id.save(update_fields=['status', 'updated_at'])
    return ok(TransactionSerializer(transaction).data, 'Thanh toán học phí thành công.')



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_tutor(request, class_id):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    enrollment = customer_enrollments(student).filter(class_id_id=class_id).select_related('class_id').first()
    if not enrollment:
        return fail('Không tìm thấy lớp của học viên.', status.HTTP_404_NOT_FOUND)
    cls = enrollment.class_id
    decision = request.data.get('decision') or request.data.get('status') or 'APPROVED'
    if cls.status != 'waiting_parent' or not cls.tutor_id:
        return fail('Lớp này chưa có gia sư chờ phụ huynh xác nhận.')
    if decision in ['APPROVED', 'approved', 'agree', 'ACCEPTED', 'accepted']:
        cls.status = 'teaching'
        if enrollment.status not in ['paid', 'completed']:
            enrollment.status = 'unpaid'
            enrollment.save(update_fields=['status', 'updated_at'])
        msg = 'Phụ huynh đã xác nhận gia sư. Lớp chuyển sang Đang học.'
    elif decision in ['REJECTED', 'rejected', 'reject', 'DECLINED', 'declined']:
        cls.tutor = None
        cls.status = 'open'
        msg = 'Phụ huynh đã từ chối gia sư. Lớp được mở lại để tìm gia sư khác.'
    else:
        return fail('Quyết định xác nhận không hợp lệ.')
    cls.save(update_fields=['tutor', 'status', 'updated_at'])
    return ok(class_payload(enrollment), msg)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reviews(request, class_id=None):
    student, students, guard = require_customer(request)
    if guard:
        return guard
    enrollment_qs = customer_enrollments(student)
    if request.method == 'GET':
        qs = Review.objects.filter(user_id=request.user, class_id__in=enrollment_qs.values_list('class_id_id', flat=True))
        return ok(ReviewSerializer(qs, many=True).data)
    try:
        enrollment = enrollment_qs.get(class_id_id=class_id)
    except Enrollment.DoesNotExist:
        return fail('Bạn không thuộc lớp này.', status.HTTP_403_FORBIDDEN)
    try:
        review, created = Review.objects.update_or_create(
            class_id=enrollment.class_id,
            user_id=request.user,
            defaults={
                'star_rating': request.data.get('starRating') or request.data.get('star_rating') or 5,
                'comment': request.data.get('comment') or '',
            },
        )
    except (IntegrityError, ValueError):
        return fail('Dữ liệu đánh giá không hợp lệ.')
    return ok(ReviewSerializer(review).data, 'Đã gửi đánh giá gia sư.', status.HTTP_201_CREATED if created else status.HTTP_200_OK)

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.classes.models import Class
from apps.classes.serializers import ClassCreateUpdateSerializer, ClassSerializer
from apps.classes.services import ClassService
from apps.finance.models import Enrollment, Transaction
from apps.finance.serializers import EnrollmentSerializer
from apps.users.models import AbsenceRequest, ClassApplication, Student, TeachingLog, Tutor, TutorQualification
from apps.users.serializers import (
    AbsenceRequestSerializer,
    ApplicationSerializer,
    StudentCreateUpdateSerializer,
    StudentSerializer,
    TeachingLogSerializer,
    TutorQualificationSerializer,
    TutorSerializer,
)
from apps.users.services import TutorService


def ok(data=None, message=None, code=status.HTTP_200_OK):
    payload = {'success': True}
    if message:
        payload['message'] = message
    if data is not None:
        payload['data'] = data
    return Response(payload, status=code)


def fail(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'message': message}, status=code)


def require_staff(request):
    if getattr(request.user, 'role', None) not in ['admin', 'staff']:
        return fail('Chỉ tài khoản staff mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    return None


def paginate(request, qs, serializer_class):
    page = int(request.GET.get('page', 1) or 1)
    limit = int(request.GET.get('limit') or request.GET.get('page_size') or 10)
    total = qs.count()
    start = max(page - 1, 0) * limit
    serializer = serializer_class(qs[start:start + limit], many=True, context={'request': request})
    return {'items': serializer.data, 'pagination': {'page': page, 'limit': limit, 'total': total}}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    guard = require_staff(request)
    if guard:
        return guard
    return ok({
        'students': Student.objects.count(),
        'tutors': Tutor.objects.count(),
        'classes': Class.objects.count(),
        'pendingStaffRequests': Class.objects.filter(status='staff_pending').count(),
        'pendingAdminClasses': 0,
        'openClasses': Class.objects.filter(status='open').count(),
        'activeClasses': Class.objects.filter(status__in=['assigned', 'waiting_tutor', 'teaching']).count(),
        'pendingApplications': ClassApplication.objects.filter(status='PENDING').count(),
        'pendingAbsenceRequests': AbsenceRequest.objects.filter(status='PENDING').count(),
        'pendingQualifications': TutorQualification.objects.filter(status='PENDING_REVIEW').count(),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def classes(request):
    guard = require_staff(request)
    if guard:
        return guard
    if request.method == 'GET':
        qs = Class.objects.all()
        if request.GET.get('status'):
            qs = qs.filter(status=request.GET['status'])
        if request.GET.get('search'):
            search = request.GET['search']
            qs = qs.filter(subject_name__icontains=search)
        return ok(paginate(request, qs, ClassSerializer))
    data = request.data.copy()
    data['status'] = 'open'
    if not data.get('tuition_fee'):
        data['tuition_fee'] = data.get('salary_per_month') or 0
    serializer = ClassCreateUpdateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    cls = serializer.save(created_by=request.user)
    return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã công khai lớp cho gia sư đăng ký nhận lớp.', status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def class_detail(request, class_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        cls = Class.objects.get(pk=class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(ClassSerializer(cls, context={'request': request}).data)
    if request.method == 'DELETE':
        cls.delete()
        return ok(message='Đã xóa lớp.')
    serializer = ClassCreateUpdateSerializer(cls, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    cls = serializer.save()
    return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã cập nhật lớp.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_tutor(request, class_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        cls = Class.objects.get(pk=class_id)
        cls = ClassService.assign_tutor(cls, request.data.get('tutor_id'))
        return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã giao gia sư.')
    except Exception as exc:
        return fail(str(exc))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_class_status(request, class_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        cls = Class.objects.get(pk=class_id)
        new_status = request.data.get('status')
        cls = ClassService.change_status(cls, new_status)
        return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã đổi trạng thái lớp.')
    except Exception as exc:
        return fail(str(exc))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def applications(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = ClassApplication.objects.select_related('tutor', 'class_obj')
    if request.GET.get('status'):
        qs = qs.filter(status=request.GET['status'])
    return ok(paginate(request, qs, ApplicationSerializer))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_application(request, application_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        application = ClassApplication.objects.select_related('class_obj').get(pk=application_id)
    except ClassApplication.DoesNotExist:
        return fail('Không tìm thấy đơn nhận lớp.', status.HTTP_404_NOT_FOUND)
    decision = request.data.get('status')
    if decision not in ['APPROVED', 'REJECTED']:
        return fail('Trạng thái phải là APPROVED hoặc REJECTED.')
    application.status = decision
    application.reviewed_at = timezone.now()
    application.rejection_reason = request.data.get('rejectionReason') or request.data.get('rejection_reason') or ''
    application.save(update_fields=['status', 'reviewed_at', 'rejection_reason'])
    if decision == 'APPROVED':
        cls = application.class_obj
        cls.tutor = application.tutor
        cls.status = 'waiting_parent'
        cls.save(update_fields=['tutor', 'status', 'updated_at'])
    return ok(ApplicationSerializer(application, context={'request': request}).data, 'Đã xử lý đơn nhận lớp.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def absence_requests(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = AbsenceRequest.objects.select_related('tutor', 'class_obj')
    if request.GET.get('status'):
        qs = qs.filter(status=request.GET['status'])
    return ok(paginate(request, qs, AbsenceRequestSerializer))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_absence(request, request_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        absence = AbsenceRequest.objects.get(pk=request_id)
    except AbsenceRequest.DoesNotExist:
        return fail('Không tìm thấy yêu cầu nghỉ/dạy bù.', status.HTTP_404_NOT_FOUND)
    decision = request.data.get('status')
    if decision not in ['APPROVED', 'REJECTED']:
        return fail('Trạng thái phải là APPROVED hoặc REJECTED.')
    absence.status = decision
    absence.admin_note = request.data.get('adminNote') or request.data.get('admin_note') or ''
    absence.save(update_fields=['status', 'admin_note'])
    return ok(AbsenceRequestSerializer(absence, context={'request': request}).data, 'Đã xử lý yêu cầu.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def qualifications(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = TutorQualification.objects.select_related('tutor')
    if request.GET.get('status'):
        qs = qs.filter(status=request.GET['status'])
    return ok(paginate(request, qs, TutorQualificationSerializer))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_qualification(request, qualification_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        qualification = TutorQualification.objects.get(pk=qualification_id)
    except TutorQualification.DoesNotExist:
        return fail('Không tìm thấy hồ sơ gia sư.', status.HTTP_404_NOT_FOUND)
    decision = request.data.get('status')
    if decision not in ['APPROVED', 'REJECTED', 'PENDING_REVIEW']:
        return fail('Trạng thái hồ sơ không hợp lệ.')
    qualification.status = decision
    qualification.save(update_fields=['status'])
    return ok(TutorQualificationSerializer(qualification, context={'request': request}).data, 'Đã cập nhật hồ sơ.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tutors(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = Tutor.objects.select_related('user').prefetch_related('availability')
    if request.GET.get('verified') in ['true', 'false']:
        qs = qs.filter(is_verified=request.GET['verified'] == 'true')
    if request.GET.get('search'):
        search = request.GET['search']
        qs = qs.filter(
            Q(full_name__icontains=search)
            | Q(university__icontains=search)
            | Q(major__icontains=search)
            | Q(experience_summary__icontains=search)
            | Q(address__icontains=search)
        )
    if request.GET.get('available_day'):
        qs = qs.filter(availability__day_of_week=request.GET['available_day'])
    if request.GET.get('min_rating'):
        qs = qs.filter(rating__gte=request.GET['min_rating'])
    return ok(paginate(request, qs.distinct(), TutorSerializer))


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def tutor_detail(request, tutor_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        tutor = Tutor.objects.get(pk=tutor_id)
    except Tutor.DoesNotExist:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        tutor.user.delete()
        return ok(message='Đã xóa gia sư.')
    if 'is_verified' in request.data:
        tutor.is_verified = request.data['is_verified']
    if 'isVerified' in request.data:
        tutor.is_verified = request.data['isVerified']
    tutor.save(update_fields=['is_verified', 'updated_at'])
    return ok(TutorSerializer(tutor, context={'request': request}).data, 'Đã cập nhật gia sư.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tutor_timetable(request, tutor_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        tutor = Tutor.objects.get(pk=tutor_id)
    except Tutor.DoesNotExist:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    return ok(TutorService.get_timetable(tutor))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def students(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = Student.objects.select_related('user')
    if request.GET.get('search'):
        qs = qs.filter(full_name__icontains=request.GET['search'])
    return ok(paginate(request, qs, StudentSerializer))


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def student_detail(request, student_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return fail('Không tìm thấy học viên.', status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        if student.user:
            student.user.delete()
        else:
            student.delete()
        return ok(message='Đã xóa học viên.')
    serializer = StudentCreateUpdateSerializer(student, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    student = serializer.save()
    return ok(StudentSerializer(student, context={'request': request}).data, 'Đã cập nhật học viên.')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def teaching_logs(request, class_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        cls = Class.objects.select_related('tutor').get(pk=class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        qs = TeachingLog.objects.filter(class_obj=cls).select_related('tutor')
        return ok(paginate(request, qs, TeachingLogSerializer))
    if not cls.tutor:
        return fail('Cần giao gia sư trước khi ghi nhận buổi học.')
    serializer = TeachingLogSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    log = serializer.save(tutor=cls.tutor, class_obj=cls)
    return ok(TeachingLogSerializer(log, context={'request': request}).data, 'Đã ghi nhận buổi học.', status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def teaching_log_detail(request, log_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        log = TeachingLog.objects.get(pk=log_id)
    except TeachingLog.DoesNotExist:
        return fail('Không tìm thấy buổi học.', status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        log.delete()
        return ok(message='Đã xóa buổi học.')
    serializer = TeachingLogSerializer(log, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    log = serializer.save()
    return ok(TeachingLogSerializer(log, context={'request': request}).data, 'Đã cập nhật buổi học.')


def _enrollment_amount(enrollment):
    cls = enrollment.class_id
    return cls.tuition_fee or cls.salary_per_month or 0


def _ensure_enrollment_transaction(enrollment):
    tx = Transaction.objects.filter(enrollment_id=enrollment, type='tuition_fee').order_by('-created_at').first()
    if tx:
        return tx
    # After Parent removal: parent info is now stored on the student.
    # Use the student's user account to create the tuition fee transaction.
    user = enrollment.student_id.user if enrollment.student_id and enrollment.student_id.user else None
    if not user:
        return None
    return Transaction.objects.create(
        user_id=user,
        enrollment_id=enrollment,
        amount=_enrollment_amount(enrollment),
        type='tuition_fee',
        status='success' if enrollment.status == 'paid' else 'pending',
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_teaching_logs(request):
    guard = require_staff(request)
    if guard:
        return guard
    qs = TeachingLog.objects.select_related('class_obj', 'tutor').order_by('-session_date', '-start_time')
    items = []
    for log in qs[:100]:
        confirmed = 'Staff xác nhận' in (log.note or '')
        if confirmed:
            display_status = 'Đã duyệt'
        elif log.attendance_status == 'ABSENT':
            display_status = 'Nghỉ có phép'
        elif 'dạy bù' in (log.note or '').lower() or 'makeup' in (log.note or '').lower():
            display_status = 'Yêu cầu dạy bù'
        else:
            display_status = 'Đã dạy'
        items.append({
            'id': log.id,
            'logId': log.id,
            'classId': log.class_obj_id,
            'className': log.class_obj.subject_name,
            'tutor': log.tutor.full_name,
            'date': log.session_date,
            'sessionDate': log.session_date,
            'startTime': log.start_time.strftime('%H:%M') if log.start_time else '',
            'endTime': log.end_time.strftime('%H:%M') if log.end_time else '',
            'status': display_status,
            'topic': log.topic,
            'content': log.content,
            'note': log.note,
        })
    return ok({'items': items, 'pagination': {'page': 1, 'limit': len(items), 'total': len(items)}})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def finance(request):
    guard = require_staff(request)
    if guard:
        return guard
    enrollments = Enrollment.objects.select_related('class_id', 'student_id', 'student_id__user')
    payment_rows = []
    for enrollment in enrollments[:100]:
        tx = _ensure_enrollment_transaction(enrollment)
        # After Parent removal: parent info is now on the student.
        # Use the student's parent_name as the payer label, fallback to the student's full name.
        student = enrollment.student_id
        parent_label = (student.parent_name if student else '') or (student.full_name if student else '') or 'Phụ huynh'
        payment_rows.append({
            'id': tx.id if tx else enrollment.id,
            'transactionId': tx.id if tx else None,
            'enrollmentId': enrollment.id,
            'parent': parent_label,
            'className': enrollment.class_id.subject_name,
            'amount': tx.amount if tx else _enrollment_amount(enrollment),
            'date': (tx.updated_at if tx else enrollment.updated_at).date().isoformat(),
            'status': 'paid' if (tx and tx.status == 'success') or enrollment.status == 'paid' else 'unpaid',
        })
    salary_rows = []
    salary_qs = (
        Class.objects
        .filter(tutor__isnull=False, status__in=['assigned', 'waiting_tutor', 'teaching', 'paused', 'completed'])
        .values('tutor_id', 'tutor__full_name', 'tutor__user__username')
        .annotate(total_salary=Sum('salary_per_month'))
        .order_by('tutor__full_name')
    )
    for row in salary_qs:
        tutor_id = row['tutor_id']
        sessions = TeachingLog.objects.filter(tutor_id=tutor_id).count()
        classes_count = Class.objects.filter(tutor_id=tutor_id).count()
        salary_rows.append({
            'tutorId': tutor_id,
            'tutorName': row['tutor__full_name'] or row['tutor__user__username'],
            'classes': classes_count,
            'sessions': sessions,
            'totalSalary': row['total_salary'] or 0,
            'status': 'Đã tính',
        })
    return ok({
        'enrollments': EnrollmentSerializer(enrollments[:100], many=True, context={'request': request}).data,
        'paymentRows': payment_rows,
        'salaryByTutor': salary_rows,
        'summary': {
            'pendingPayment': enrollments.exclude(status='paid').count(),
            'paid': enrollments.filter(status='paid').count(),
            'successfulRevenue': Transaction.objects.filter(status='success', type__in=['tuition_fee', 'commission']).aggregate(total=Sum('amount'))['total'] or 0,
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_enrollment_status(request, enrollment_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        enrollment = Enrollment.objects.get(pk=enrollment_id)
    except Enrollment.DoesNotExist:
        return fail('Không tìm thấy ghi danh.', status.HTTP_404_NOT_FOUND)
    new_status = request.data.get('status')
    if new_status not in ['paid', 'unpaid']:
        return fail('Trạng thái thanh toán chỉ được là paid hoặc unpaid.')
    enrollment.status = new_status
    enrollment.save(update_fields=['status', 'updated_at'])
    tx = _ensure_enrollment_transaction(enrollment)
    if tx and new_status == 'paid':
        tx.status = 'success'
        tx.save(update_fields=['status', 'updated_at'])
    return ok(EnrollmentSerializer(enrollment, context={'request': request}).data, 'Đã cập nhật trạng thái thanh toán.')

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_class_request(request, class_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        cls = Class.objects.get(pk=class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy yêu cầu tìm gia sư.', status.HTTP_404_NOT_FOUND)
    decision = request.data.get('status') or request.data.get('decision')
    if cls.status not in ['staff_pending', 'open']:
        return fail('Yêu cầu này đã được xử lý, không thể công khai lại.')
    if decision in ['APPROVED', 'approved', 'PROCESSING', 'open', 'PUBLIC']:
        cls.status = 'open'
        msg = 'Đã công khai lớp cho gia sư đăng ký nhận lớp.'
    elif decision in ['REJECTED', 'rejected', 'cancelled']:
        cls.status = 'cancelled'
        msg = 'Đã từ chối yêu cầu tìm gia sư.'
    else:
        return fail('Trạng thái xử lý không hợp lệ.')
    cls.save(update_fields=['status', 'updated_at'])
    return ok(ClassSerializer(cls, context={'request': request}).data, msg)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_tutor(request, tutor_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        tutor = Tutor.objects.get(pk=tutor_id)
    except Tutor.DoesNotExist:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    class_id = request.data.get('classId') or request.data.get('class_id')
    cls = Class.objects.filter(pk=class_id).first() if class_id else None
    if not cls:
        return fail('Vui lòng chọn yêu cầu/lớp cần gửi gia sư cho phụ huynh xác nhận.')
    if cls.status not in ['staff_pending', 'open']:
        return fail('Lớp này không còn ở trạng thái có thể gửi gia sư.')
    cls.tutor = tutor
    cls.status = 'waiting_parent'
    cls.save(update_fields=['tutor', 'status', 'updated_at'])
    app, _ = ClassApplication.objects.get_or_create(tutor=tutor, class_obj=cls, defaults={'cover_note': 'Nhân viên đề xuất gia sư cho phụ huynh xác nhận.', 'status': 'APPROVED'})
    if app.status != 'APPROVED':
        app.status = 'APPROVED'
        app.reviewed_at = timezone.now()
        app.save(update_fields=['status', 'reviewed_at'])
    return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã gửi gia sư cho phụ huynh xác nhận.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_teaching_log(request, log_id):
    guard = require_staff(request)
    if guard:
        return guard
    try:
        log = TeachingLog.objects.get(pk=log_id)
    except TeachingLog.DoesNotExist:
        return fail('Không tìm thấy buổi học.', status.HTTP_404_NOT_FOUND)
    log.note = ((log.note or '') + '\nStaff xác nhận buổi học.').strip()
    log.save(update_fields=['note', 'updated_at'])
    return ok(TeachingLogSerializer(log, context={'request': request}).data, 'Đã xác nhận buổi học.')

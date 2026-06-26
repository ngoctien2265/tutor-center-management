from collections import defaultdict
from datetime import date, timedelta
import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.classes.models import Class
from apps.classes.serializers import ClassSerializer
from apps.feedback.models import Review
from apps.finance.models import Enrollment, Transaction
from apps.users.models import Student, Tutor, User, TeachingLog
from apps.users.serializers import TutorSerializer, UserSerializer
from apps.users.serializers.tutor import parse_schedule_text


ACTIVE_CLASS_STATUSES = ['assigned', 'waiting_tutor', 'teaching', 'paused']
REVIEWED_CLASS_STATUSES = ['open', 'waiting_parent', 'assigned', 'waiting_tutor', 'teaching', 'paused']
PHONE_RE = re.compile(r'^(0|\+84)[0-9]{9,10}$')


def ok(data=None, message=None, code=status.HTTP_200_OK):
    payload = {'success': True}
    if message:
        payload['message'] = message
    if data is not None:
        payload['data'] = data
    return Response(payload, status=code)


def fail(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'message': message}, status=code)


def require_admin(request):
    if getattr(request.user, 'role', None) != 'admin':
        return fail('Chỉ tài khoản admin mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    return None


def paginate(request, qs, serializer_class):
    page = int(request.GET.get('page', 1) or 1)
    limit = int(request.GET.get('limit') or request.GET.get('page_size') or 50)
    total = qs.count()
    start = max(page - 1, 0) * limit
    serializer = serializer_class(qs[start:start + limit], many=True, context={'request': request})
    return {'items': serializer.data, 'pagination': {'page': page, 'limit': limit, 'total': total}}


def user_data(user):
    return UserSerializer(user).data


def profile_item(label, value):
    return {'label': label, 'value': value or 'Chưa cập nhật'}


def display_user_name(user):
    if not user:
        return 'Chưa cập nhật'
    if getattr(user, 'role', None) == 'tutor' and hasattr(user, 'tutor_profile'):
        return user.tutor_profile.full_name
    if getattr(user, 'role', None) == 'student' and hasattr(user, 'student_profile'):
        return user.student_profile.full_name
    return user.get_full_name() or user.first_name or user.username


def staff_sections(user):
    managed_classes = Class.objects.filter(created_by=user).count()
    return [
        {
            'title': 'Thông tin nhân viên',
            'items': [
                profile_item('Họ tên', display_user_name(user)),
                profile_item('Email', user.email),
                profile_item('Số điện thoại', user.phone),
                profile_item('Số lớp đã tạo/quản lý', managed_classes),
                profile_item('Trạng thái hồ sơ', 'Đang làm việc' if user.status == 'active' and user.is_active else 'Chờ duyệt / tạm dừng'),
                profile_item('Trạng thái tài khoản', 'Đang hoạt động' if user.is_active else 'Đã khóa'),
                profile_item('Ngày tạo', user.created_at),
            ],
        }
    ]


def tutor_sections(tutor):
    qualifications = [
        {
            'Tên hồ sơ': q.title,
            'Loại': q.get_document_type_display() if hasattr(q, 'get_document_type_display') else q.document_type,
            'Trạng thái': q.get_status_display() if hasattr(q, 'get_status_display') else q.status,
            'Mô tả': q.description or 'Chưa cập nhật',
        }
        for q in tutor.qualifications.all()
    ]
    availability = [
        {
            'Thứ': item.get_day_of_week_display() if hasattr(item, 'get_day_of_week_display') else item.day_of_week,
            'Bắt đầu': item.start_time.strftime('%H:%M'),
            'Kết thúc': item.end_time.strftime('%H:%M'),
        }
        for item in tutor.availability.all()
    ]
    class_count = Class.objects.filter(tutor=tutor, status__in=ACTIVE_CLASS_STATUSES + ['completed']).count()
    completed_count = Class.objects.filter(tutor=tutor, status='completed').count()
    sessions_this_month = TeachingLog.objects.filter(
        tutor=tutor,
        session_date__year=timezone.localdate().year,
        session_date__month=timezone.localdate().month,
    ).count()
    return [
        {
            'title': 'Thông tin cá nhân',
            'items': [
                profile_item('Họ tên', tutor.full_name),
                profile_item('Giới tính', tutor.gender),
                profile_item('Ngày sinh', tutor.birthday),
                profile_item('Địa chỉ', tutor.address),
                profile_item('Email', tutor.user.email),
                profile_item('Số điện thoại', tutor.user.phone),
            ],
        },
        {
            'title': 'Thông tin chuyên môn',
            'items': [
                profile_item('Trường đại học', tutor.university),
                profile_item('Chuyên ngành', tutor.major),
                profile_item('Môn có thể dạy', tutor.teachable_subjects),
                profile_item('Khối lớp có thể dạy', tutor.teachable_grades),
                profile_item('Khu vực nhận lớp', tutor.teaching_areas),
                profile_item('Kinh nghiệm', tutor.experience_summary),
                profile_item('Đánh giá', tutor.rating),
                profile_item('Lớp đang/đã dạy', class_count),
                profile_item('Lớp hoàn thành', completed_count),
                profile_item('Buổi dạy tháng này', sessions_this_month),
                profile_item('Xác thực', 'Đã duyệt' if tutor.is_verified else 'Chờ duyệt'),
            ],
        },
        {'title': 'Bằng cấp / chứng chỉ', 'items': qualifications},
        {'title': 'Lịch rảnh', 'items': availability},
    ]


def student_sections(student):
    enrollments = [
        {
            'Lớp học': enrollment.class_id.subject_name,
            'Khối lớp': enrollment.class_id.grade_level or student.grade_level,
            'Gia sư': enrollment.class_id.tutor.full_name if enrollment.class_id.tutor else 'Chưa có',
            'Trạng thái': enrollment.class_id.get_status_display(),
            'Ngày ghi danh': enrollment.enrolled_at,
        }
        for enrollment in Enrollment.objects.select_related('class_id', 'class_id__tutor').filter(student_id=student)
    ]
    return [
        {
            'title': 'Thông tin học viên',
            'items': [
                profile_item('Họ tên', student.full_name),
                profile_item('Giới tính', student.gender),
                profile_item('Ngày sinh', student.birthday),
                profile_item('Khối lớp', student.grade_level),
                profile_item('Trường học', student.school_name),
                profile_item('Ghi chú', student.note),
            ],
        },
        {
            'title': 'Phụ huynh / liên hệ',
            'items': [
                profile_item('Họ tên phụ huynh', student.parent_name),
                profile_item('Email phụ huynh', student.parent_email),
                profile_item('SĐT phụ huynh', student.parent_phone),
                profile_item('Địa chỉ', student.address),
            ],
        },
        {'title': 'Lớp đang học', 'items': enrollments},
    ]


def build_profile(user):
    if user.role == 'tutor':
        try:
            tutor = Tutor.objects.prefetch_related('qualifications', 'availability').get(user=user)
        except Tutor.DoesNotExist:
            return {'user': user_data(user), 'roleLabel': 'Gia sư', 'sections': staff_sections(user)}
        return {'user': user_data(user), 'roleLabel': 'Gia sư', 'profileName': tutor.full_name, 'sections': tutor_sections(tutor)}

    if user.role == 'student':
        try:
            student = Student.objects.select_related('user').get(user=user)
        except Student.DoesNotExist:
            return {'user': user_data(user), 'roleLabel': 'Học viên', 'sections': staff_sections(user)}
        return {'user': user_data(user), 'roleLabel': 'Học viên', 'profileName': student.full_name, 'sections': student_sections(student)}

    return {'user': user_data(user), 'roleLabel': 'Nhân viên' if user.role == 'staff' else 'Tài khoản', 'profileName': display_user_name(user), 'sections': staff_sections(user)}


def month_keys():
    today = timezone.localdate().replace(day=1)
    months = []
    for i in range(5, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month, f'T{month}'))
    return months


def monthly_count(qs, date_field='created_at'):
    values = {key: 0 for key in month_keys()}
    for row in qs.annotate(month_value=TruncMonth(date_field)).values('month_value').annotate(total=Count('id')):
        month = row['month_value']
        if month:
            for key in values:
                if key[0] == month.year and key[1] == month.month:
                    values[key] = row['total']
    return [values[key] for key in values]


def monthly_sum(qs, amount_field='amount', date_field='updated_at'):
    values = {key: 0 for key in month_keys()}
    for row in qs.annotate(month_value=TruncMonth(date_field)).values('month_value').annotate(total=Sum(amount_field)):
        month = row['month_value']
        if month:
            for key in values:
                if key[0] == month.year and key[1] == month.month:
                    values[key] = int(row['total'] or 0)
    return [values[key] for key in values]


def current_month_info():
    today = timezone.localdate()
    return today.year, today.month, f'Tháng {today.month}'


WEEKDAY_INDEX = {
    'MONDAY': 0,
    'TUESDAY': 1,
    'WEDNESDAY': 2,
    'THURSDAY': 3,
    'FRIDAY': 4,
    'SATURDAY': 5,
    'SUNDAY': 6,
}


def expected_sessions_in_month(class_obj, year, month):
    slots = parse_schedule_text(class_obj.schedule_detail)
    weekdays = {WEEKDAY_INDEX[slot.get('dayOfWeek')] for slot in slots if slot.get('dayOfWeek') in WEEKDAY_INDEX}
    if not weekdays:
        return 0
    first_day = date(year, month, 1)
    next_month = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
    start_day = max(first_day, class_obj.start_date) if class_obj.start_date else first_day
    count = 0
    current = start_day
    while current < next_month:
        if current.weekday() in weekdays:
            count += 1
        current += timedelta(days=1)
    if class_obj.total_sessions:
        return min(count, class_obj.total_sessions)
    return count


def current_month_week_labels():
    return ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4']


def month_week_index(value):
    if not value:
        return None
    day = value.date().day if hasattr(value, 'date') else value.day
    return min(max((day - 1) // 7, 0), 3)


def current_month_count(qs, date_field='created_at'):
    year, month, _ = current_month_info()
    values = [0, 0, 0, 0]
    filtered = qs.filter(**{f'{date_field}__year': year, f'{date_field}__month': month})
    for value in filtered.values_list(date_field, flat=True):
        idx = month_week_index(value)
        if idx is not None:
            values[idx] += 1
    return values


def current_month_sum(qs, amount_field='amount', date_field='updated_at'):
    year, month, _ = current_month_info()
    values = [0, 0, 0, 0]
    filtered = qs.filter(**{f'{date_field}__year': year, f'{date_field}__month': month})
    for value, amount in filtered.values_list(date_field, amount_field):
        idx = month_week_index(value)
        if idx is not None:
            values[idx] += int(amount or 0)
    return values


def class_display_status(cls):
    if cls.status == 'staff_pending':
        return 'staff_pending'
    if cls.status == 'pending_admin':
        return 'pending_admin'
    if cls.status == 'waiting_parent':
        return 'waiting_parent'
    if cls.status == 'cancelled':
        return 'cancelled'
    if cls.status == 'completed':
        return 'completed'
    if cls.tutor_id and cls.status in REVIEWED_CLASS_STATUSES + ['assigned', 'waiting_tutor', 'teaching', 'paused']:
        return 'teaching'
    if not cls.tutor_id:
        return 'open'
    return cls.status


def money_int(value):
    return int(value or 0)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    guard = require_admin(request)
    if guard:
        return guard

    classes = Class.objects.select_related('tutor')
    status_counts = defaultdict(int)
    for cls in classes:
        status_counts[class_display_status(cls)] += 1

    success_transactions = Transaction.objects.filter(status='success')
    tuition_revenue = success_transactions.filter(type='tuition_fee').aggregate(total=Sum('amount'))['total'] or 0
    commission_revenue = success_transactions.filter(type='commission').aggregate(total=Sum('amount'))['total'] or 0
    revenue = tuition_revenue + commission_revenue
    current_year, current_month, month_label = current_month_info()

    overview_values = [Tutor.objects.count(), Student.objects.count(), status_counts['teaching']]
    overview_chart = {
        'labels': ['Tổng số gia sư', 'Tổng số học viên', 'Lớp đang hoạt động'],
        'values': overview_values,
    }

    top_tutors_raw = []
    for tutor in Tutor.objects.select_related('user').filter(is_verified=True):
        review_summary = Review.objects.filter(
            class_id__tutor=tutor,
            created_at__year=current_year,
            created_at__month=current_month,
        ).aggregate(avg=Avg('star_rating'), total=Count('id'))
        avg_star = float(review_summary['avg'] or 0)
        review_count = int(review_summary['total'] or 0)
        top_tutors_raw.append((avg_star, review_count, float(tutor.rating or 0), tutor))
    top_tutors_raw.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)

    top_tutors = []
    for avg_star, review_count, _, tutor in top_tutors_raw[:5]:
        top_tutors.append({
            'id': tutor.id,
            'avatar': (tutor.full_name or 'G')[:1].upper(),
            'name': tutor.full_name,
            'description': f'{tutor.teachable_subjects or tutor.major or "Gia sư"} - {review_count} đánh giá',
            'rating': round(avg_star, 1),
            'reviewCount': review_count,
        })

    system_classes = Class.objects.all()
    month_status_counts = defaultdict(int)
    for cls in system_classes.select_related('tutor'):
        month_status_counts[class_display_status(cls)] += 1
    subject_distribution = list(
        system_classes.values('subject_name').annotate(count=Count('id')).order_by('-count')[:8]
    )
    grade_distribution = list(
        system_classes.values('grade_level').annotate(count=Count('id')).order_by('grade_level')
    )

    month_labels = current_month_week_labels()
    class_trend = current_month_count(Class.objects.all())
    tutor_trend = current_month_count(Tutor.objects.all())
    student_trend = current_month_count(Student.objects.all())
    revenue_trend = [round(v / 1000000, 2) for v in current_month_sum(success_transactions.filter(type__in=['tuition_fee', 'commission']))]

    return ok({
        'totals': {
            'users': User.objects.count(),
            'staff': User.objects.filter(role='staff').count(),
            'tutors': Tutor.objects.count(),
            'students': Student.objects.count(),
            'classes': Class.objects.count(),
            'activeClasses': status_counts['teaching'],
            'enrollments': Enrollment.objects.count(),
            'revenue': money_int(revenue),
        },
        'classStatus': dict(status_counts),
        'pending': {
            'staff': User.objects.filter(role='staff', status='inactive').count(),
            'tutors': Tutor.objects.filter(is_verified=False).count(),
            'classes': Class.objects.filter(status='pending_admin').count(),
        },
        'activity': {
            'activeUsers': User.objects.filter(is_active=True).count(),
            'lockedUsers': User.objects.filter(is_active=False).count(),
            'activeEnrollments': Enrollment.objects.filter(status__in=['active', 'paid']).count(),
        },
        'charts': {
            'labels': month_labels,
            'monthLabel': month_label,
            'overview': overview_chart,
            'classTrend': class_trend,
            'tutorTrend': tutor_trend,
            'studentTrend': student_trend,
            'revenueTrend': revenue_trend,
            'subjectDistribution': subject_distribution,
            'gradeDistribution': grade_distribution,
            'statusDistribution': [{'status': key, 'count': value} for key, value in dict(month_status_counts).items()],
        },
        'topTutors': top_tutors,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def finance_summary(request):
    guard = require_admin(request)
    if guard:
        return guard

    today = timezone.localdate()
    success_transactions = Transaction.objects.filter(status='success')
    tuition_revenue = success_transactions.filter(type='tuition_fee').aggregate(total=Sum('amount'))['total'] or 0
    commission_revenue = success_transactions.filter(type='commission').aggregate(total=Sum('amount'))['total'] or 0
    refunds = success_transactions.filter(type='refund').aggregate(total=Sum('amount'))['total'] or 0
    tutor_salary_total = Class.objects.filter(tutor__isnull=False, status__in=ACTIVE_CLASS_STATUSES + ['completed']).aggregate(total=Sum('salary_per_month'))['total'] or 0

    payment_rows = []
    for tx in Transaction.objects.select_related('user_id', 'user_id__student_profile', 'enrollment_id', 'enrollment_id__class_id').filter(type='tuition_fee').order_by('-created_at'):
        enrollment = tx.enrollment_id
        payment_rows.append({
            'id': tx.id,
            'transactionId': tx.id,
            'enrollmentId': enrollment.id if enrollment else None,
            'parent': display_user_name(tx.user_id),
            'className': enrollment.class_id.subject_name if enrollment else 'Lớp học',
            'classId': enrollment.class_id_id if enrollment else None,
            'amount': money_int(tx.amount),
            'date': tx.updated_at.date().isoformat(),
            'status': 'paid' if tx.status == 'success' else 'unpaid',
        })
    recent_payments = payment_rows[:20]

    class_payment_status = []
    class_stats = {}
    for enrollment in Enrollment.objects.select_related('class_id'):
        class_obj = enrollment.class_id
        key = class_obj.id if class_obj else enrollment.id
        if key not in class_stats:
            class_stats[key] = {
                'classId': class_obj.id if class_obj else None,
                'className': class_obj.subject_name if class_obj else 'Lớp học',
                'paid': 0,
                'unpaid': 0,
                'total': 0,
                'totalFee': 0,
            }
        class_stats[key]['total'] += 1
        class_stats[key]['totalFee'] += money_int(class_obj.tuition_fee if class_obj else 0)
        if enrollment.status in ['paid', 'active', 'completed']:
            class_stats[key]['paid'] += 1
        else:
            class_stats[key]['unpaid'] += 1
    class_payment_status = list(class_stats.values())

    salary_rows = []
    for tutor in Tutor.objects.select_related('user').filter(classes_teaching__isnull=False).distinct().order_by('full_name'):
        classes_qs = Class.objects.filter(tutor=tutor, status__in=ACTIVE_CLASS_STATUSES + ['completed'])
        monthly_logs = TeachingLog.objects.filter(tutor=tutor, session_date__year=today.year, session_date__month=today.month)
        sessions = monthly_logs.count()
        approved_sessions = monthly_logs.filter(note__icontains='Staff xác nhận').count()
        total_monthly_sessions = sum(expected_sessions_in_month(class_obj, today.year, today.month) for class_obj in classes_qs)
        payable = total_monthly_sessions > 0 and approved_sessions >= total_monthly_sessions
        salary = classes_qs.aggregate(total=Sum('salary_per_month'))['total'] or 0
        salary_paid = Transaction.objects.filter(user_id=tutor.user, type='tutor_salary', status='success').exists()
        salary_rows.append({
            'tutorId': tutor.id,
            'tutorUserId': tutor.user_id,
            'tutorName': tutor.full_name,
            'salaryMonth': f'Tháng {today.month}/{today.year}',
            'bankName': tutor.bank_name or '',
            'bankBranch': tutor.bank_branch or '',
            'bankAccountNumber': tutor.bank_account_number or '',
            'classes': classes_qs.count(),
            'sessions': sessions,
            'approvedSessions': approved_sessions,
            'totalMonthlySessions': total_monthly_sessions,
            'canPaySalary': payable,
            'sessionLabel': f'{approved_sessions}/{total_monthly_sessions} buổi đã duyệt trong tháng {today.month}',
            'salary': money_int(salary),
            'status': 'paid' if salary_paid else 'unpaid',
        })

    revenue_monthly = current_month_sum(success_transactions.filter(type__in=['tuition_fee', 'commission']))
    salary_monthly = current_month_sum(success_transactions.filter(type='tutor_salary'))
    profit_monthly = [max(0, revenue_monthly[i] - salary_monthly[i]) for i in range(len(revenue_monthly))]
    _, _, month_label = current_month_info()

    return ok({
        'summary': {
            'tuitionRevenue': money_int(tuition_revenue),
            'commissionRevenue': money_int(commission_revenue),
            'refunds': money_int(refunds),
            'netRevenue': money_int(tuition_revenue + commission_revenue - refunds),
            'tutorSalaryTotal': money_int(tutor_salary_total),
            'expectedProfit': money_int(tuition_revenue + commission_revenue - refunds - tutor_salary_total),
            'uncollectedTuition': money_int(Transaction.objects.filter(type='tuition_fee').exclude(status='success').aggregate(total=Sum('amount'))['total'] or 0),
            'transactions': Transaction.objects.count(),
            'successfulTransactions': success_transactions.count(),
            'enrollments': Enrollment.objects.count(),
            'activeEnrollments': Enrollment.objects.filter(status__in=['active', 'paid']).count(),
        },
        'recentPayments': recent_payments,
        'paymentRows': payment_rows,
        'classPaymentStatus': class_payment_status,
        'salaryRows': salary_rows,
        'charts': {
            'labels': current_month_week_labels(),
            'monthLabel': month_label,
            'revenue': [round(v / 1000000, 2) for v in revenue_monthly],
            'salary': [round(v / 1000000, 2) for v in salary_monthly],
            'profit': [round(v / 1000000, 2) for v in profit_monthly],
        },
        'transactionsByStatus': {
            'paid': Transaction.objects.filter(status='success').count(),
            'unpaid': Transaction.objects.exclude(status='success').count(),
        },
        'enrollmentsByStatus': {
            key: Enrollment.objects.filter(status=key).count()
            for key, _ in Enrollment.STATUS_CHOICES
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_tuition_payment_status(request, transaction_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        tx = Transaction.objects.select_related('enrollment_id').get(pk=transaction_id, type='tuition_fee')
    except Transaction.DoesNotExist:
        return fail('Không tìm thấy khoản học phí.', status.HTTP_404_NOT_FOUND)
    new_status = request.data.get('status')
    if new_status not in ['paid', 'unpaid']:
        return fail('Trạng thái thanh toán chỉ được là paid hoặc unpaid.')
    tx.status = 'success' if new_status == 'paid' else 'pending'
    tx.save(update_fields=['status', 'updated_at'])
    if tx.enrollment_id:
        tx.enrollment_id.status = 'paid' if new_status == 'paid' else 'unpaid'
        tx.enrollment_id.save(update_fields=['status', 'updated_at'])
    return ok({
        'transactionId': tx.id,
        'status': new_status,
        'enrollmentStatus': tx.enrollment_id.status if tx.enrollment_id else None,
    }, 'Đã đồng bộ trạng thái thanh toán học phí.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay_tutor_salary(request, tutor_id):
    guard = require_admin(request)
    if guard:
        return guard
    tutor = Tutor.objects.select_related('user').filter(pk=tutor_id).first()
    if not tutor or not tutor.user:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    classes_qs = Class.objects.filter(tutor=tutor, status__in=ACTIVE_CLASS_STATUSES + ['completed'])
    salary = classes_qs.aggregate(total=Sum('salary_per_month'))['total'] or 0
    if salary <= 0:
        return fail('Gia sư này chưa có lương cần thanh toán.')
    tx, _ = Transaction.objects.update_or_create(
        user_id=tutor.user,
        type='tutor_salary',
        status='success',
        defaults={'amount': salary},
    )
    return ok({
        'transactionId': tx.id,
        'tutorId': tutor.id,
        'amount': money_int(tx.amount),
        'status': 'paid',
    }, 'Đã xác nhận thanh toán lương gia sư.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def class_requests(request):
    guard = require_admin(request)
    if guard:
        return guard
    qs = Class.objects.filter(status='pending_admin')
    return ok(paginate(request, qs, ClassSerializer))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_class(request, class_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        cls = Class.objects.get(pk=class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp.', status.HTTP_404_NOT_FOUND)
    if cls.status != 'pending_admin':
        return fail('Chỉ được duyệt hoặc từ chối các lớp đang ở trạng thái Chờ duyệt.')

    decision = request.data.get('status') or request.data.get('decision')
    if decision in ['APPROVED', 'approved', 'approve', 'APPROVE', 'open']:
        cls.status = 'teaching' if cls.tutor_id else 'open'
    elif decision in ['REJECTED', 'rejected', 'reject', 'REJECT', 'cancelled', 'CANCELLED']:
        cls.status = 'cancelled'
    else:
        return fail('Trạng thái duyệt lớp không hợp lệ.')
    cls.admin_note = request.data.get('adminNote') or request.data.get('admin_note') or ''
    cls.save(update_fields=['status', 'admin_note', 'updated_at'])
    return ok(ClassSerializer(cls, context={'request': request}).data, 'Đã xử lý yêu cầu mở lớp.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_members(request):
    guard = require_admin(request)
    if guard:
        return guard
    qs = User.objects.filter(role='staff')
    if request.GET.get('status'):
        qs = qs.filter(status=request.GET['status'])
    return ok(paginate(request, qs, UserSerializer))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_staff(request, staff_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        staff = User.objects.get(pk=staff_id, role='staff')
    except User.DoesNotExist:
        return fail('Không tìm thấy nhân viên.', status.HTTP_404_NOT_FOUND)
    staff.status = 'active'
    staff.is_staff = True
    staff.save(update_fields=['status', 'is_staff', 'updated_at'])
    return ok(UserSerializer(staff, context={'request': request}).data, 'Đã duyệt nhân viên.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unverify_staff(request, staff_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        staff = User.objects.get(pk=staff_id, role='staff')
    except User.DoesNotExist:
        return fail('Không tìm thấy nhân viên.', status.HTTP_404_NOT_FOUND)
    staff.status = 'inactive'
    staff.is_staff = False
    staff.save(update_fields=['status', 'is_staff', 'updated_at'])
    return ok(UserSerializer(staff, context={'request': request}).data, 'Đã hủy duyệt nhân viên.')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_staff(request, staff_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        staff = User.objects.get(pk=staff_id, role='staff')
    except User.DoesNotExist:
        return fail('Không tìm thấy nhân viên.', status.HTTP_404_NOT_FOUND)
    if request.user.id == staff.id:
        return fail('Admin không thể tự xóa tài khoản của mình.')
    staff.delete()
    return ok(message='Đã xóa nhân viên.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_tutor(request, tutor_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        tutor = Tutor.objects.select_related('user').get(pk=tutor_id)
    except Tutor.DoesNotExist:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    tutor.is_verified = True
    tutor.user.status = 'active'
    tutor.save(update_fields=['is_verified', 'updated_at'])
    tutor.user.save(update_fields=['status', 'updated_at'])
    return ok(TutorSerializer(tutor, context={'request': request}).data, 'Đã duyệt hồ sơ gia sư.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unverify_tutor(request, tutor_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        tutor = Tutor.objects.select_related('user').get(pk=tutor_id)
    except Tutor.DoesNotExist:
        return fail('Không tìm thấy gia sư.', status.HTTP_404_NOT_FOUND)
    tutor.is_verified = False
    tutor.user.status = 'inactive'
    tutor.save(update_fields=['is_verified', 'updated_at'])
    tutor.user.save(update_fields=['status', 'updated_at'])
    return ok(TutorSerializer(tutor, context={'request': request}).data, 'Đã hủy duyệt hồ sơ gia sư.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    return ok(build_profile(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lock_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    if request.user.id == user_id:
        return fail('Admin không thể tự khóa tài khoản của mình.')
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    if user.role == 'admin' or user.is_superuser:
        return fail('Không được khóa tài khoản admin.')
    user.is_active = False
    user.save(update_fields=['is_active', 'updated_at'])
    return ok(UserSerializer(user, context={'request': request}).data, 'Đã khóa tài khoản.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unlock_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    user.is_active = True
    user.save(update_fields=['is_active', 'updated_at'])
    return ok(UserSerializer(user, context={'request': request}).data, 'Đã mở tài khoản.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.select_related('tutor_profile').get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    if user.role == 'admin' or user.is_superuser:
        return fail('Không duyệt tài khoản admin tại màn hình này.')
    if user.role not in ['staff', 'tutor', 'student']:
        return fail('Chỉ duyệt tài khoản Nhân viên, Gia sư hoặc Học viên.')

    user.status = 'active'
    update_fields = ['status', 'updated_at']
    if user.role == 'staff':
        user.is_staff = True
        update_fields.append('is_staff')
    user.save(update_fields=update_fields)
    if user.role == 'tutor' and hasattr(user, 'tutor_profile'):
        user.tutor_profile.is_verified = True
        user.tutor_profile.save(update_fields=['is_verified', 'updated_at'])
    return ok(UserSerializer(user, context={'request': request}).data, 'Đã duyệt tài khoản.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.select_related('tutor_profile').get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    if user.role == 'admin' or user.is_superuser:
        return fail('Không hủy duyệt tài khoản admin.')
    if user.role not in ['staff', 'tutor', 'student']:
        return fail('Chỉ hủy duyệt tài khoản Nhân viên, Gia sư hoặc Học viên.')

    user.status = 'inactive'
    update_fields = ['status', 'updated_at']
    if user.role == 'staff':
        user.is_staff = False
        update_fields.append('is_staff')
    user.save(update_fields=update_fields)
    if user.role == 'tutor' and hasattr(user, 'tutor_profile'):
        user.tutor_profile.is_verified = False
        user.tutor_profile.save(update_fields=['is_verified', 'updated_at'])
    return ok(UserSerializer(user, context={'request': request}).data, 'Đã hủy duyệt tài khoản.')


def validate_user_payload(data, partial=False, current_user=None):
    errors = {}
    full_name = (data.get('fullName') or data.get('full_name') or data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    role = data.get('role') or (None if partial else 'staff')
    password = data.get('password') or ''

    if not partial or full_name:
        if len(full_name) < 2:
            errors['fullName'] = 'Vui lòng nhập họ tên thật.'
    if not partial or email:
        try:
            validate_email(email)
        except ValidationError:
            errors['email'] = 'Email không đúng định dạng.'
        email_qs = User.objects.filter(email=email)
        if current_user:
            email_qs = email_qs.exclude(pk=current_user.pk)
        if email and email_qs.exists():
            errors['email'] = 'Email đã tồn tại.'
    if not partial or phone:
        if not PHONE_RE.match(phone):
            errors['phone'] = 'Số điện thoại phải bắt đầu bằng 0 hoặc +84 và có 10-11 số.'
        phone_qs = User.objects.filter(phone=phone)
        if current_user:
            phone_qs = phone_qs.exclude(pk=current_user.pk)
        if phone and phone_qs.exists():
            errors['phone'] = 'Số điện thoại đã tồn tại.'
    if role is not None and role not in ['staff', 'tutor', 'student']:
        errors['role'] = 'Vai trò chỉ được chọn: Nhân viên, Gia sư hoặc Học viên.'
    if not partial and len(password) < 6:
        errors['password'] = 'Mật khẩu tối thiểu 6 ký tự.'
    if errors:
        return None, errors
    payload = {'full_name': full_name, 'email': email, 'phone': phone, 'password': password}
    if role is not None:
        payload['role'] = role
    return payload, None


def make_username(email, full_name='user'):
    base = re.sub(r'[^\w.@+-]', '_', (email.split('@')[0] if email else full_name).strip().lower())[:120] or 'user'
    username = base
    index = 1
    while User.objects.filter(username=username).exists():
        index += 1
        username = f'{base}_{index}'[:150]
    return username


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    guard = require_admin(request)
    if guard:
        return guard
    if request.method == 'GET':
        qs = User.objects.select_related('tutor_profile').filter(role__in=['staff', 'tutor', 'student']).order_by('-date_joined')
        role = request.GET.get('role')
        if role:
            qs = qs.filter(role=role)
        search = request.GET.get('search')
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(first_name__icontains=search) | Q(email__icontains=search))
        return ok(paginate(request, qs, UserSerializer))

    data, errors = validate_user_payload(request.data, partial=False)
    if errors:
        return fail(errors)

    role = data['role']
    if role not in ['staff', 'tutor', 'student']:
        return fail('Chỉ được thêm tài khoản Nhân viên, Gia sư hoặc Học viên.')

    username = (request.data.get('username') or make_username(data['email'], data['full_name'])).strip()
    if User.objects.filter(username=username).exists():
        return fail({'username': 'Tên đăng nhập đã tồn tại.'})
    user = User.objects.create_user(
        username=username,
        email=data['email'],
        password=data['password'],
        role=role,
        phone=data['phone'],
        status=request.data.get('status') or 'active',
        is_active=True,
        first_name=data['full_name'],
    )
    address = request.data.get('address') or ''
    if role == 'tutor':
        Tutor.objects.create(
            user=user,
            full_name=data['full_name'],
            address=address,
            university=request.data.get('university') or '',
            major=request.data.get('major') or '',
            teachable_subjects=request.data.get('teachableSubjects') or request.data.get('subjects') or '',
            teachable_grades=request.data.get('teachableGrades') or request.data.get('grades') or 'Lớp 10',
            teaching_areas=request.data.get('teachingAreas') or '',
            is_verified=False,
        )
    elif role == 'student':
        student_data = {
            'full_name': data['full_name'],
            'parent_name': request.data.get('parentName', data['full_name']),
            'parent_phone': data.get('phone'),
            'parent_email': data.get('email'),
            'address': address,
            'grade_level': request.data.get('gradeLevel') or 'G10',
        }
        Student.objects.create(user=user, **student_data)

    return ok(UserSerializer(user, context={'request': request}).data, 'Đã thêm tài khoản.', status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    if user.role == 'admin' and user.id != request.user.id:
        return fail('Không được chỉnh sửa tài khoản admin khác.')

    data, errors = validate_user_payload(request.data, partial=True, current_user=user)
    if errors:
        return fail(errors)

    if data and data.get('full_name'):
        user.first_name = data['full_name']
    if data and data.get('email'):
        user.email = data['email']
    if data and data.get('phone'):
        user.phone = data['phone']
    if data and data.get('role') and user.role != 'admin':
        user.role = data['role']
    if 'status' in request.data:
        user.status = request.data['status'] or user.status
    if 'password' in request.data and request.data['password']:
        if len(request.data['password']) < 6:
            return fail('Mật khẩu tối thiểu 6 ký tự.')
        user.set_password(request.data['password'])
    user.save()

    full_name = data['full_name'] if data and data.get('full_name') else (user.first_name or user.username)
    address = request.data.get('address')
    if user.role == 'tutor':
        tutor, _ = Tutor.objects.get_or_create(user=user, defaults={'full_name': full_name})
        tutor.full_name = full_name
        if address is not None:
            tutor.address = address
        for api_key, field in [('university', 'university'), ('major', 'major'), ('teachableSubjects', 'teachable_subjects'), ('teachableGrades', 'teachable_grades'), ('teachingAreas', 'teaching_areas')]:
            if api_key in request.data:
                setattr(tutor, field, request.data.get(api_key) or '')
        tutor.save()
    elif user.role == 'student':
        student, _ = Student.objects.get_or_create(user=user, defaults={
            'full_name': full_name,
            'parent_phone': user.phone,
            'parent_email': user.email
        })
        student.full_name = full_name
        if address is not None:
            student.address = address
        if 'parentName' in request.data:
            student.parent_name = request.data['parentName']
        if 'parentPhone' in request.data:
            student.parent_phone = request.data['parentPhone']
        if 'parentEmail' in request.data:
            student.parent_email = request.data['parentEmail']
        student.save()

    return ok(UserSerializer(user, context={'request': request}).data, 'Đã cập nhật tài khoản.')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    guard = require_admin(request)
    if guard:
        return guard
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return fail('Không tìm thấy tài khoản.', status.HTTP_404_NOT_FOUND)
    if user.role == 'admin' or user.is_superuser or user.id == request.user.id:
        return fail('Không được xóa tài khoản admin.')
    user.delete()
    return ok(message='Đã xóa tài khoản khỏi hệ thống.')

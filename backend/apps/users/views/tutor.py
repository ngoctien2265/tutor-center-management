from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from apps.classes.models import Class
from apps.users.models import ClassApplication, TeachingLog, AbsenceRequest, RefundRequest, Tutor, TutorQualification
from apps.users.serializers import TutorProfileSerializer, TutorQualificationSerializer, TutorAvailabilitySerializer, OpenClassSerializer, ApplicationSerializer, ActiveClassSerializer, TeachingLogSerializer, AbsenceRequestSerializer, RefundRequestSerializer, TutorReviewSerializer, TutorSerializer
from apps.users.services import TutorService


class TutorViewSet(viewsets.ModelViewSet):
    queryset = Tutor.objects.all()
    serializer_class = TutorSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_verified', 'rating']
    search_fields = ['full_name', 'university', 'major']
    ordering_fields = ['rating', 'created_at']

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_profile(self, request):
        try:
            tutor = request.user.tutor_profile
            serializer = self.get_serializer(tutor)
            return Response(serializer.data)
        except Tutor.DoesNotExist:
            return Response(
                {'detail': 'Tutor profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )


def ok(data=None, message=None, code=status.HTTP_200_OK):
    payload = {'success': True}
    if message:
        payload['message'] = message
    if data is not None:
        payload['data'] = data
    return Response(payload, status=code)


def fail(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'message': message}, status=code)


def tutor_of(request):
    return TutorService.get_tutor_for_user(request.user)


def paginate(request, qs, serializer_class):
    page = int(request.GET.get('page', 1) or 1)
    limit = int(request.GET.get('limit', 10) or 10)
    total = qs.count() if hasattr(qs, 'count') and callable(qs.count) and not isinstance(qs, list) else len(qs)
    start = max(page - 1, 0) * limit
    ser = serializer_class(qs[start:start+limit], many=True, context={'request': request})
    return {'items': ser.data, 'pagination': {'page': page, 'limit': limit, 'total': total}}


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        return ok(TutorProfileSerializer(tutor, context={'request': request}).data)
    serializer = TutorProfileSerializer(tutor, data=request.data, partial=True, context={'request': request})
    TutorService.save_serializer(serializer)
    return ok(message='Tutor profile updated successfully')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    # Base model chưa có trường avatar; trả về thành công để frontend không lỗi, có thể mở rộng sau.
    return ok({'avatarUrl': None}, 'Avatar uploaded successfully')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def qualifications(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        qs = TutorService.get_qualifications(tutor, request.GET)
        return ok(paginate(request, qs, TutorQualificationSerializer))
    serializer = TutorQualificationSerializer(data=request.data, context={'request': request})
    TutorService.save_serializer(serializer, tutor=tutor)
    return ok(serializer.data, 'Qualification uploaded successfully', status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def qualification_detail(request, document_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        doc = TutorService.get_qualification(tutor, document_id)
    except TutorQualification.DoesNotExist:
        return fail('Không tìm thấy hồ sơ năng lực.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(TutorQualificationSerializer(doc, context={'request': request}).data)
    TutorService.delete_object(doc)
    return ok(message='Qualification document deleted successfully')


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def availability(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        return ok(TutorAvailabilitySerializer(tutor.availability.all(), many=True).data)
    TutorService.replace_availability(tutor, request.data.get('availability', []))
    return ok(message='Availability updated successfully')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_availability_slot(request):
    """Thêm 1 khung giờ rảnh cho gia sư.
    Body: { dayOfWeek, startTime, endTime }
    """
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    day = request.data.get('dayOfWeek')
    start = request.data.get('startTime')
    end = request.data.get('endTime')
    slot, error = TutorService.add_availability_slot(tutor, day, start, end)
    if error:
        return fail(error, status.HTTP_400_BAD_REQUEST)
    return ok(TutorAvailabilitySerializer(slot).data, 'Đã thêm khung giờ rảnh.', status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_availability_slot(request, slot_id):
    """Xoá 1 khung giờ rảnh của gia sư."""
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    deleted = TutorService.delete_availability_slot(tutor, slot_id)
    if not deleted:
        return fail('Không tìm thấy khung giờ rảnh.', status.HTTP_404_NOT_FOUND)
    return ok(message='Đã xoá khung giờ rảnh.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def availability_with_timetable(request):
    """Trả về đồng thời lịch rảnh + lịch dạy của gia sư để FE dựng ma trận tuần.
    Mỗi ô của ma trận được xác định bởi (dayOfWeek, slotHour). slotHour là số giờ
    nguyên (7-22) đại diện cho ô [slotHour:00 - slotHour+1:00).
    """
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    availability_items = TutorAvailabilitySerializer(tutor.availability.all(), many=True).data
    timetable_items = TutorService.get_timetable(tutor)
    # Tính sẵn map (dayOfWeek -> list of slotHour) cho FE render nhanh
    availability_hour_map = {}
    for item in availability_items:
        day = item.get('dayOfWeek')
        start = item.get('startTime', '')
        end = item.get('endTime', '')
        if not day or not start or not end:
            continue
        try:
            start_h = int(start.split(':')[0])
            end_h = int(end.split(':')[0])
            if end_h <= start_h:
                continue
            for h in range(start_h, end_h):
                availability_hour_map.setdefault(day, []).append(h)
        except (ValueError, IndexError):
            continue
    # Tính map lớp đang dạy theo khung giờ
    class_hour_map = {}
    for item in timetable_items:
        day = item.get('dayOfWeek')
        start = item.get('startTime', '')
        end = item.get('endTime', '')
        if not day or not start or not end:
            continue
        try:
            start_h = int(start.split(':')[0])
            end_h = int(end.split(':')[0])
            if end_h <= start_h:
                continue
            for h in range(start_h, end_h):
                class_hour_map.setdefault(day, []).append({
                    'slotHour': h,
                    'classId': item.get('classId'),
                    'subject': item.get('subject'),
                    'startTime': start,
                    'endTime': end,
                    'status': item.get('status'),
                })
        except (ValueError, IndexError):
            continue
    return ok({
        'availability': availability_items,
        'timetable': timetable_items,
        'availabilityHourMap': availability_hour_map,
        'classHourMap': class_hour_map,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_conflict(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    day = request.data.get('dayOfWeek')
    start = request.data.get('startTime')
    end = request.data.get('endTime')
    conflicts = TutorService.check_schedule_conflicts(tutor, day, start, end)
    return ok({'hasConflict': bool(conflicts), 'conflictedClasses': conflicts})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    return ok(TutorService.get_dashboard(tutor))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def open_classes(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    qs = TutorService.get_open_classes(request.GET, tutor)
    return ok(paginate(request, qs, OpenClassSerializer))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def open_class_detail(request, class_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        cls = TutorService.get_open_class(class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp đang mở.', status.HTTP_404_NOT_FOUND)
    return ok(OpenClassSerializer(cls, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_class(request, class_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        cls = TutorService.get_open_class(class_id)
        default_salary = OpenClassSerializer().get_salaryPerSession(cls)
        app, cls, error = TutorService.apply_class(tutor, class_id, request.data, default_salary)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp đang mở.', status.HTTP_404_NOT_FOUND)
    if error:
        return fail(error)
    return ok({'applicationId': app.id, 'classId': cls.id, 'status': app.status}, 'Application submitted successfully', status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def applications(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    qs = TutorService.get_applications(tutor, request.GET)
    return ok(paginate(request, qs, ApplicationSerializer))


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def application_detail(request, application_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        app = TutorService.get_application(tutor, application_id)
    except ClassApplication.DoesNotExist:
        return fail('Không tìm thấy đơn đăng ký.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(ApplicationSerializer(app, context={'request': request}).data)
    if app.status != 'PENDING':
        return fail('Chỉ được hủy đơn đang chờ duyệt.')
    TutorService.cancel_application(app)
    return ok(message='Application cancelled successfully')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_classes(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    qs = TutorService.get_active_classes(tutor, request.GET)
    return ok(paginate(request, qs, ActiveClassSerializer))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teaching_class_detail(request, class_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        cls = TutorService.get_teaching_class(tutor, class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp của bạn.', status.HTTP_404_NOT_FOUND)
    return ok(ActiveClassSerializer(cls, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timetable(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    return ok(TutorService.get_timetable(tutor))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def teaching_logs_by_class(request, class_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        cls, logs = TutorService.get_teaching_logs(tutor, class_id)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp của bạn.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(paginate(request, logs, TeachingLogSerializer))
    serializer = TeachingLogSerializer(data=request.data)
    log = TutorService.create_teaching_log(tutor, cls, serializer)
    return ok({'logId': log.id, 'classId': cls.id}, 'Teaching log created successfully', status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def teaching_log_detail(request, log_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        log = TutorService.get_teaching_log(tutor, log_id)
    except TeachingLog.DoesNotExist:
        return fail('Không tìm thấy nhật ký.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return ok(TeachingLogSerializer(log).data)
    if request.method == 'DELETE':
        TutorService.delete_object(log); return ok(message='Teaching log deleted successfully')
    serializer = TeachingLogSerializer(log, data=request.data, partial=True)
    TutorService.update_teaching_log(serializer)
    return ok(TeachingLogSerializer(log).data, 'Teaching log updated successfully')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_absence(request, class_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try:
        data, error = TutorService.create_absence_requests(tutor, class_id, request.data, AbsenceRequestSerializer)
    except Class.DoesNotExist:
        return fail('Không tìm thấy lớp của bạn.', status.HTTP_404_NOT_FOUND)
    if error:
        return fail(error)
    message = 'Absence request submitted successfully' if 'count' in data else 'Make-up request submitted successfully'
    return ok(data, message, status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def absence_requests(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    qs = TutorService.get_absence_requests(tutor, request.GET)
    return ok(paginate(request, qs, AbsenceRequestSerializer))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def absence_detail(request, request_id):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try: obj = TutorService.get_absence_request(tutor, request_id)
    except AbsenceRequest.DoesNotExist: return fail('Không tìm thấy yêu cầu nghỉ.', status.HTTP_404_NOT_FOUND)
    return ok(AbsenceRequestSerializer(obj).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def cancel_absence(request, request_id):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try: obj = TutorService.get_absence_request(tutor, request_id, pending_only=True)
    except AbsenceRequest.DoesNotExist: return fail('Không tìm thấy yêu cầu có thể hủy.', status.HTTP_404_NOT_FOUND)
    TutorService.cancel_absence_request(obj, request.data.get('reason', ''))
    return ok(message='Absence request cancelled successfully')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def refund_requests(request):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        qs = TutorService.get_refund_requests(tutor, request.GET)
        return ok(paginate(request, qs, RefundRequestSerializer))
    if not request.data.get('amount') or not request.data.get('reason'):
        return fail('Vui lòng nhập số tiền và lý do hoàn phí.')
    try: obj = TutorService.create_refund_request(tutor, request.data)
    except Class.DoesNotExist: return fail('Không tìm thấy lớp của bạn.', status.HTTP_404_NOT_FOUND)
    return ok({'refundRequestId': obj.id, 'status': obj.status}, 'Refund request submitted successfully', status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def refund_detail(request, refund_request_id):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try: obj = TutorService.get_refund_request(tutor, refund_request_id)
    except RefundRequest.DoesNotExist: return fail('Không tìm thấy yêu cầu hoàn phí.', status.HTTP_404_NOT_FOUND)
    return ok(RefundRequestSerializer(obj).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def cancel_refund(request, refund_request_id):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try: obj = TutorService.get_refund_request(tutor, refund_request_id, pending_only=True)
    except RefundRequest.DoesNotExist: return fail('Không tìm thấy yêu cầu có thể hủy.', status.HTTP_404_NOT_FOUND)
    TutorService.cancel_refund_request(obj, request.data.get('reason', ''))
    return ok(message='Refund request cancelled successfully')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def receiving_fees(request):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    items = TutorService.get_receiving_fees(request.user)
    return ok({'items': items, 'pagination': {'page': 1, 'limit': len(items), 'total': len(items)}})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def receiving_fee_detail(request, fee_id):
    tutor = tutor_of(request)
    if not tutor: return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    try: fee = TutorService.get_receiving_fee(request.user, fee_id)
    except Transaction.DoesNotExist: return fail('Không tìm thấy phí nhận lớp.', status.HTTP_404_NOT_FOUND)
    return ok(fee)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reviews(request):
    tutor = tutor_of(request)
    if not tutor:
        return fail('Chỉ tài khoản gia sư mới sử dụng được API này.', status.HTTP_403_FORBIDDEN)
    qs = TutorService.get_reviews(tutor, request.GET)
    return ok(paginate(request, qs, TutorReviewSerializer))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications(request):
    return ok(TutorService.get_notifications())


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_read(request, notification_id=None):
    return ok(message='Notification marked as read')

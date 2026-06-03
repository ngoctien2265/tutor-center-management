from rest_framework import serializers
from django.conf import settings

from apps.classes.models import Class
from apps.finance.models import Enrollment, Transaction
from apps.feedback.models import Review
from apps.users.models import Tutor, TutorQualification, TutorAvailability, ClassApplication, TeachingLog, AbsenceRequest, RefundRequest
from .user import UserSerializer


def abs_url(request, file_field):
    if not file_field:
        return None
    url = file_field.url
    if request:
        return request.build_absolute_uri(url)
    return url


class TutorSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Tutor
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'rating']



class TutorProfileSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='user.username', read_only=True)
    fullName = serializers.CharField(source='full_name')
    email = serializers.EmailField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', required=False, allow_blank=True, allow_null=True)
    dateOfBirth = serializers.DateField(source='birthday', required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    avatarUrl = serializers.SerializerMethodField()
    bio = serializers.CharField(source='experience_summary', required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField(source='user.status', read_only=True)
    university = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    major = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    teachableSubjects = serializers.CharField(source='teachable_subjects', required=False, allow_blank=True, allow_null=True)
    teachableGrades = serializers.CharField(source='teachable_grades', required=False, allow_blank=True, allow_null=True)
    teachingAreas = serializers.CharField(source='teaching_areas', required=False, allow_blank=True, allow_null=True)
    bankName = serializers.CharField(source='bank_name', required=False, allow_blank=True, allow_null=True)
    bankBranch = serializers.CharField(source='bank_branch', required=False, allow_blank=True, allow_null=True)
    bankAccountNumber = serializers.CharField(source='bank_account_number', required=False, allow_blank=True, allow_null=True)
    rating = serializers.FloatField(read_only=True)
    isVerified = serializers.BooleanField(source='is_verified', read_only=True)

    class Meta:
        model = Tutor
        fields = ['id','fullName','email','phone','dateOfBirth','gender','address','avatarUrl','bio','status','university','major','teachableSubjects','teachableGrades','teachingAreas','bankName','bankBranch','bankAccountNumber','rating','isVerified']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['gender'] = {'M': 'MALE', 'F': 'FEMALE', 'O': 'OTHER'}.get(instance.gender, instance.gender)
        return data

    def get_avatarUrl(self, obj):
        return None

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if 'phone' in user_data:
            instance.user.phone = user_data['phone']
            instance.user.save(update_fields=['phone', 'updated_at'])
        if 'gender' in validated_data:
            validated_data['gender'] = {'MALE': 'M', 'FEMALE': 'F', 'OTHER': 'O'}.get(validated_data['gender'], validated_data['gender'])
        return super().update(instance, validated_data)


class TutorQualificationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    documentType = serializers.CharField(source='document_type')
    fileUrl = serializers.SerializerMethodField()
    uploadedAt = serializers.DateTimeField(source='uploaded_at', read_only=True)

    class Meta:
        model = TutorQualification
        fields = ['id','documentType','title','description','file','fileUrl','status','uploadedAt']
        extra_kwargs = {'file': {'write_only': True, 'required': False}}

    def get_fileUrl(self, obj):
        return abs_url(self.context.get('request'), obj.file)

    def validate_documentType(self, value):
        allowed = {'DEGREE', 'TRANSCRIPT', 'CERTIFICATE'}
        if value not in allowed:
            raise serializers.ValidationError('Loại hồ sơ chỉ được chọn: Bằng cấp, Bảng điểm hoặc Chứng chỉ.')
        return value

    def validate_file(self, value):
        if not value:
            return value
        content_type = getattr(value, 'content_type', '') or ''
        allowed = {'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'}
        if content_type not in allowed:
            raise serializers.ValidationError('File chỉ được phép là PDF hoặc hình ảnh.')
        return value


class TutorAvailabilitySerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    dayOfWeek = serializers.CharField(source='day_of_week')
    startTime = serializers.TimeField(source='start_time', format='%H:%M')
    endTime = serializers.TimeField(source='end_time', format='%H:%M')

    class Meta:
        model = TutorAvailability
        fields = ['id','dayOfWeek','startTime','endTime']



DAY_MAP = {
    'thứ 2': ('MONDAY', 'Thứ 2'), 'thu 2': ('MONDAY', 'Thứ 2'), 'monday': ('MONDAY', 'Thứ 2'),
    'thứ 3': ('TUESDAY', 'Thứ 3'), 'thu 3': ('TUESDAY', 'Thứ 3'), 'tuesday': ('TUESDAY', 'Thứ 3'),
    'thứ 4': ('WEDNESDAY', 'Thứ 4'), 'thu 4': ('WEDNESDAY', 'Thứ 4'), 'wednesday': ('WEDNESDAY', 'Thứ 4'),
    'thứ 5': ('THURSDAY', 'Thứ 5'), 'thu 5': ('THURSDAY', 'Thứ 5'), 'thursday': ('THURSDAY', 'Thứ 5'),
    'thứ 6': ('FRIDAY', 'Thứ 6'), 'thu 6': ('FRIDAY', 'Thứ 6'), 'friday': ('FRIDAY', 'Thứ 6'),
    'thứ 7': ('SATURDAY', 'Thứ 7'), 'thu 7': ('SATURDAY', 'Thứ 7'), 'saturday': ('SATURDAY', 'Thứ 7'),
    'chủ nhật': ('SUNDAY', 'Chủ nhật'), 'chu nhat': ('SUNDAY', 'Chủ nhật'), 'sunday': ('SUNDAY', 'Chủ nhật'),
}


def parse_schedule_text(text):
    import re
    if not text:
        return []
    results = []
    chunks = text.split(',')
    last_day_code, last_day_label = 'MONDAY', 'Thứ 2'
    for chunk in chunks:
        raw = chunk.lower()
        day_code, day_label = None, None
        for key, value in DAY_MAP.items():
            if key in raw:
                day_code, day_label = value
                break
        if day_code:
            last_day_code, last_day_label = day_code, day_label
        else:
            day_code, day_label = last_day_code, last_day_label
        times = re.findall(r'(\d{1,2}:\d{2})', chunk)
        if len(times) >= 2:
            results.append({
                'dayOfWeek': day_code,
                'dayLabel': day_label,
                'startTime': times[0],
                'endTime': times[1],
                'note': chunk.strip()
            })
    return results

class OpenClassSerializer(serializers.ModelSerializer):
    classId = serializers.CharField(source='id')
    subject = serializers.CharField(source='subject_name')
    level = serializers.SerializerMethodField()
    location = serializers.CharField(source='address_teaching')
    teachingMode = serializers.SerializerMethodField()
    expectedHourlyRate = serializers.DecimalField(source='expected_hourly_rate', max_digits=10, decimal_places=2, read_only=True)
    salaryPerSession = serializers.SerializerMethodField()
    feeAmount = serializers.SerializerMethodField()
    schedule = serializers.SerializerMethodField()
    description = serializers.CharField(source='requirements')
    applicationDeadline = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    sessionsPerWeek = serializers.IntegerField(source='sessions_per_week', read_only=True)
    totalSessions = serializers.IntegerField(source='total_sessions', read_only=True)
    startDate = serializers.DateField(source='start_date', read_only=True)
    durationLabel = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['classId','subject','level','location','teachingMode','expectedHourlyRate','salaryPerSession','feeAmount','schedule','requirements','description','applicationDeadline','status','sessionsPerWeek','totalSessions','startDate','durationLabel']

    def get_teachingMode(self, obj):
        return (obj.teaching_mode or 'offline').upper()

    def get_level(self, obj):
        if getattr(obj, 'grade_level', None):
            return obj.grade_level
        text = f'{obj.subject_name} {obj.requirements or ""}'.lower()
        for grade in ['12','11','10','9','8','7','6','5','4','3','2','1']:
            if f'lớp {grade}' in text or f'lop {grade}' in text:
                return f'Lớp {grade}'
        return 'Phổ thông'
    def get_salaryPerSession(self, obj):
        try:
            return int(obj.salary_per_month) // max((obj.sessions_per_week or 1) * 4, 1)
        except Exception:
            return 0
    def get_feeAmount(self, obj):
        return int(self.get_salaryPerSession(obj) * 2)
    def get_status(self, obj):
        return obj.status.upper()
    def get_applicationDeadline(self, obj):
        return None
    def get_schedule(self, obj):
        return parse_schedule_text(obj.schedule_detail)

    def get_durationLabel(self, obj):
        import re
        text = f'{obj.requirements or ""} {obj.schedule_detail or ""}'.lower()
        m = re.search(r'(\d+)\s*tháng', text)
        if m:
            return f'{m.group(1)} tháng'
        if obj.sessions_per_week >= 3:
            return '3 tháng'
        return '2 tháng'


class ApplicationSerializer(serializers.ModelSerializer):
    applicationId = serializers.CharField(source='id', read_only=True)
    classId = serializers.CharField(source='class_obj.id', read_only=True)
    subject = serializers.CharField(source='class_obj.subject_name', read_only=True)
    level = serializers.SerializerMethodField()
    location = serializers.CharField(source='class_obj.address_teaching', read_only=True)
    coverNote = serializers.CharField(source='cover_note', required=False, allow_blank=True, allow_null=True)
    expectedSalary = serializers.DecimalField(source='expected_salary', max_digits=12, decimal_places=2, required=False, allow_null=True)
    availableScheduleNote = serializers.CharField(source='available_schedule_note', required=False, allow_blank=True, allow_null=True)
    submittedAt = serializers.DateTimeField(source='submitted_at', read_only=True)
    approvedAt = serializers.SerializerMethodField()
    reviewedAt = serializers.DateTimeField(source='reviewed_at', read_only=True)
    rejectionReason = serializers.CharField(source='rejection_reason', read_only=True)
    class_info = serializers.SerializerMethodField()
    tutorName = serializers.CharField(source='tutor.full_name', read_only=True)
    tutor = serializers.SerializerMethodField()

    class Meta:
        model = ClassApplication
        fields = ['applicationId','classId','subject','level','location','status','coverNote','expectedSalary','availableScheduleNote','submittedAt','approvedAt','reviewedAt','rejectionReason','class_info','tutorName','tutor']

    def get_level(self, obj):
        return OpenClassSerializer().get_level(obj.class_obj)
    def get_approvedAt(self, obj):
        return obj.reviewed_at if obj.status == 'APPROVED' else None
    def get_class_info(self, obj):
        enrollment = obj.class_obj.enrollments.select_related('student_id').first()
        return {
            'classId': obj.class_obj.id,
            'subject': obj.class_obj.subject_name,
            'level': OpenClassSerializer().get_level(obj.class_obj),
            'location': obj.class_obj.address_teaching,
            'studentName': enrollment.student_id.full_name if enrollment else '',
        }
    def get_tutor(self, obj):
        return {
            'id': obj.tutor_id,
            'fullName': obj.tutor.full_name,
            'full_name': obj.tutor.full_name,
            'email': obj.tutor.user.email if obj.tutor.user else '',
            'phone': obj.tutor.user.phone if obj.tutor.user else '',
        }


class ActiveClassSerializer(OpenClassSerializer):
    studentName = serializers.SerializerMethodField()
    studentPhone = serializers.SerializerMethodField()
    parentName = serializers.SerializerMethodField()
    parentPhone = serializers.SerializerMethodField()
    nextSession = serializers.SerializerMethodField()
    class Meta(OpenClassSerializer.Meta):
        fields = ['classId','subject','level','studentName','studentPhone','parentName','parentPhone','location','teachingMode','salaryPerSession','schedule','requirements','status','nextSession','sessionsPerWeek','totalSessions','startDate','durationLabel']
    def _enrollment(self, obj):
        return obj.enrollments.filter(status='active').first() or obj.enrollments.first()
    def get_studentName(self, obj):
        e = self._enrollment(obj)
        return e.student_id.full_name if e else 'Chưa có học viên'
    def get_studentPhone(self, obj):
        e = self._enrollment(obj)
        if e and e.student_id.user and e.student_id.user.phone:
            return e.student_id.user.phone
        return ''
    def get_parentName(self, obj):
        e = self._enrollment(obj)
        if e and e.student_id:
            return e.student_id.parent_name or ''
        return ''
    def get_parentPhone(self, obj):
        e = self._enrollment(obj)
        if e and e.student_id:
            return e.student_id.parent_phone or ''
        return ''
    def get_nextSession(self, obj):
        slot = self.get_schedule(obj)[0] if self.get_schedule(obj) else {}
        return {'date': None, 'startTime': slot.get('startTime','18:00'), 'endTime': slot.get('endTime','19:30')}


class TeachingLogSerializer(serializers.ModelSerializer):
    logId = serializers.CharField(source='id', read_only=True)
    classId = serializers.CharField(source='class_obj.id', read_only=True)
    sessionDate = serializers.DateField(source='session_date')
    startTime = serializers.TimeField(source='start_time', format='%H:%M')
    endTime = serializers.TimeField(source='end_time', format='%H:%M')
    studentUnderstandingLevel = serializers.CharField(source='student_understanding_level')
    attendanceStatus = serializers.CharField(source='attendance_status')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = TeachingLog
        fields = ['logId','classId','sessionDate','startTime','endTime','topic','content','studentUnderstandingLevel','attendanceStatus','homework','note','createdAt']


class AbsenceRequestSerializer(serializers.ModelSerializer):
    requestId = serializers.CharField(source='id', read_only=True)
    tutorName = serializers.CharField(source='tutor.full_name', read_only=True)
    classId = serializers.CharField(source='class_obj.id', read_only=True)
    subject = serializers.CharField(source='class_obj.subject_name', read_only=True)
    sessionDate = serializers.DateField(source='session_date')
    requestType = serializers.CharField(source='request_type')
    proposedMakeupDate = serializers.DateField(source='proposed_makeup_date', required=False, allow_null=True)
    proposedStartTime = serializers.TimeField(source='proposed_start_time', format='%H:%M', required=False, allow_null=True)
    proposedEndTime = serializers.TimeField(source='proposed_end_time', format='%H:%M', required=False, allow_null=True)
    adminNote = serializers.CharField(source='admin_note', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = AbsenceRequest
        fields = ['requestId','classId','subject','tutorName','sessionDate','reason','requestType','proposedMakeupDate','proposedStartTime','proposedEndTime','note','status','adminNote','createdAt']


class RefundRequestSerializer(serializers.ModelSerializer):
    refundRequestId = serializers.CharField(source='id', read_only=True)
    classId = serializers.CharField(source='class_obj.id', read_only=True)
    receivingFeeId = serializers.CharField(source='receiving_fee_id', required=False, allow_blank=True, allow_null=True)
    approvedAmount = serializers.DecimalField(source='approved_amount', max_digits=12, decimal_places=2, read_only=True)
    adminNote = serializers.CharField(source='admin_note', read_only=True)
    bankAccount = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = RefundRequest
        fields = ['refundRequestId','classId','receivingFeeId','amount','approvedAmount','reason','status','adminNote','bankAccount','createdAt']

    def get_bankAccount(self, obj):
        return {'bankName': obj.bank_name, 'accountNumber': obj.account_number, 'accountHolder': obj.account_holder}


class TutorReviewSerializer(serializers.ModelSerializer):
    reviewId = serializers.CharField(source='id', read_only=True)
    classId = serializers.CharField(source='class_id.id', read_only=True)
    subject = serializers.CharField(source='class_id.subject_name', read_only=True)
    reviewer = serializers.SerializerMethodField()
    starRating = serializers.IntegerField(source='star_rating', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Review
        fields = ['reviewId','classId','subject','reviewer','starRating','comment','createdAt']

    def get_reviewer(self, obj):
        user = obj.user_id
        if hasattr(user, 'student_profile'):
            return user.student_profile.full_name
        return user.get_full_name() or user.username

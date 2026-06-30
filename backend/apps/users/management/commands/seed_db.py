from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.classes.models import Class
from apps.feedback.models import Review
from apps.finance.models import Enrollment, Transaction
from apps.users.models import (
    AbsenceRequest,
    ClassApplication,
    RefundRequest,
    Student,
    TeachingLog,
    Tutor,
    TutorAvailability,
    TutorQualification,
    User,
)


class Command(BaseCommand):
    help = 'Seed database with rich demo data for the tutor center project'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear all data before seeding')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()

        if User.objects.filter(username='admin').exists():
            self.stdout.write(self.style.WARNING('Database already has admin user. Use --clear to recreate demo data.'))
            return

        self.stdout.write(self.style.SUCCESS('Creating full demo data...'))
        data = self.create_demo_data()
        self.print_summary(data)

    def clear_database(self):
        self.stdout.write(self.style.WARNING('Clearing database...'))
        Review.objects.all().delete()
        Transaction.objects.all().delete()
        Enrollment.objects.all().delete()
        TeachingLog.objects.all().delete()
        AbsenceRequest.objects.all().delete()
        RefundRequest.objects.all().delete()
        ClassApplication.objects.all().delete()
        TutorAvailability.objects.all().delete()
        TutorQualification.objects.all().delete()
        Class.objects.all().delete()
        Student.objects.all().delete()
        Tutor.objects.all().delete()
        User.objects.all().delete()

    def user(self, username, email, password, role, phone, full_name, status='active', is_staff=False, is_superuser=False, is_active=True):
        if is_superuser:
            obj = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                role=role,
                phone=phone,
                status=status,
                first_name=full_name,
            )
        else:
            obj = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role=role,
                phone=phone,
                status=status,
                first_name=full_name,
            )
        obj.is_staff = is_staff or is_superuser
        obj.is_superuser = is_superuser
        obj.is_active = is_active
        obj.save(update_fields=['is_staff', 'is_superuser', 'is_active'])
        return obj

    def create_tutor(self, username, email, password, phone, full_name, gender, birthday, address,
                     university, major, subjects, grades, areas, experience, rating, verified,
                     bank_suffix='001'):
        user = self.user(username, email, password, 'tutor', phone, full_name, status='active')
        tutor = Tutor.objects.create(
            user=user,
            full_name=full_name,
            gender=gender,
            birthday=birthday,
            address=address,
            university=university,
            major=major,
            teachable_subjects=subjects,
            teachable_grades=grades,
            teaching_areas=areas,
            experience_summary=experience,
            bank_name='MB Bank',
            bank_branch='TP.HCM',
            bank_account_number=f'9704{bank_suffix}888999',
            rating=rating,
            is_verified=verified,
        )
        return tutor

    def create_student(self, username, email, password, phone, full_name, gender, birthday, grade,
                       school, _contact_name, address, note):
        user = self.user(username, email, password, 'student', phone, full_name, status='active')
        student = Student.objects.create(
            user=user,
            full_name=full_name,
            gender=gender,
            birthday=birthday,
            grade_level=grade,
            school_name=school,
            address=address,
            note=note,
        )
        return student

    def add_availability(self, tutor, slots):
        for day, start, end in slots:
            TutorAvailability.objects.create(
                tutor=tutor,
                day_of_week=day,
                start_time=time.fromisoformat(start),
                end_time=time.fromisoformat(end),
            )

    def add_qualifications(self, tutor, rows):
        for doc_type, title, status, description in rows:
            TutorQualification.objects.create(
                tutor=tutor,
                document_type=doc_type,
                title=title,
                status=status,
                description=description,
            )

    def create_class(self, created_by, subject, grade, schedule, sessions_per_week, salary,
                     tuition, address, requirements, status, tutor=None, start_offset=0,
                     total_sessions=24, mode='offline', hourly=180000, admin_note=''):
        today = timezone.localdate()
        return Class.objects.create(
            tutor=tutor,
            created_by=created_by,
            subject_name=subject,
            grade_level=grade,
            start_date=today + timedelta(days=start_offset),
            schedule_detail=schedule,
            sessions_per_week=sessions_per_week,
            total_sessions=total_sessions,
            salary_per_month=Decimal(str(salary)),
            tuition_fee=Decimal(str(tuition)),
            address_teaching=address,
            requirements=requirements,
            admin_note=admin_note,
            teaching_mode=mode,
            expected_hourly_rate=Decimal(str(hourly)),
            status=status,
        )

    def enroll(self, cls, student, status):
        return Enrollment.objects.create(class_id=cls, student_id=student, status=status)

    def add_tuition_transaction(self, enrollment, status=None):
        if status is None:
            status = 'success' if enrollment.status in ['paid', 'active', 'completed'] else 'pending'
        return Transaction.objects.create(
            user_id=enrollment.student_id.user,
            enrollment_id=enrollment,
            amount=enrollment.class_id.tuition_fee or enrollment.class_id.salary_per_month,
            type='tuition_fee',
            status=status,
        )

    def next_date_for_weekday(self, weekday):
        today = timezone.localdate()
        delta = (weekday - today.weekday()) % 7
        return today + timedelta(days=delta or 7)

    def dates_this_month(self, weekdays, limit=8):
        today = timezone.localdate()
        current = date(today.year, today.month, 1)
        if today.month == 12:
            next_month = date(today.year + 1, 1, 1)
        else:
            next_month = date(today.year, today.month + 1, 1)
        values = []
        while current < next_month and len(values) < limit:
            if current.weekday() in weekdays:
                values.append(current)
            current += timedelta(days=1)
        return values

    def add_logs(self, tutor, cls, weekdays, topics, confirmed_count=4):
        dates = self.dates_this_month(weekdays, limit=len(topics))
        created = []
        for idx, session_date in enumerate(dates):
            confirmed = idx < confirmed_count
            created.append(TeachingLog.objects.create(
                tutor=tutor,
                class_obj=cls,
                session_date=session_date,
                start_time=time(18, 0),
                end_time=time(19, 30),
                topic=topics[idx],
                content='Ôn lý thuyết, luyện bài tập theo năng lực học viên.',
                student_understanding_level='GOOD' if idx % 4 != 3 else 'BAD',
                attendance_status='PRESENT',
                homework='Làm bài tập về nhà và chuẩn bị bài tiếp theo.',
                note='Staff xác nhận buổi học hợp lệ.' if confirmed else 'Gia sư đã gửi nhật ký, chờ nhân viên xác nhận.',
            ))
        return created

    def create_demo_data(self):
        today = timezone.localdate()

        admin = self.user('admin', 'admin@giasucenter.vn', 'admin123', 'admin', '0901000000', 'Nguyễn Văn Admin', is_staff=True, is_superuser=True)
        staff_1 = self.user('staff_1', 'staff1@giasucenter.vn', 'staff123', 'staff', '0901000001', 'Trần Minh Quân', status='active', is_staff=True)
        staff_2 = self.user('staff_2', 'staff2@giasucenter.vn', 'staff123', 'staff', '0901000002', 'Lê Hoàng Anh', status='active', is_staff=True)
        staff_pending = self.user('staff_pending', 'staff.pending@giasucenter.vn', 'staff123', 'staff', '0901000003', 'Phạm Gia Hân', status='inactive', is_staff=True)

        tutor_1 = self.create_tutor(
            'tutor_1', 'lan.nguyen@giasucenter.vn', 'tutor123', '0902000001',
            'Nguyễn Thị Lan', 'F', date(1998, 5, 12), 'Quận 1, TP.HCM',
            'Đại học Sư phạm TP.HCM', 'Sư phạm Toán', 'Toán, Lý', 'G10, G11, G12, Lớp 10, Lớp 11, Lớp 12',
            'Quận 1, Quận 3, Bình Thạnh', '5 năm kinh nghiệm luyện thi THPT môn Toán.', 4.9, True, '001'
        )
        tutor_2 = self.create_tutor(
            'tutor_2', 'minh.tran@giasucenter.vn', 'tutor123', '0902000002',
            'Trần Quốc Minh', 'M', date(1997, 9, 20), 'Quận 7, TP.HCM',
            'Đại học Khoa học Tự nhiên', 'Công nghệ thông tin', 'Tin học, Toán, Lập trình Python', 'G8, G9, G10, G11, G12',
            'Quận 4, Quận 7, Nhà Bè, Online', 'Gia sư Tin học và lập trình cho học sinh cấp 2-3.', 4.7, True, '002'
        )
        tutor_3 = self.create_tutor(
            'tutor_3', 'hoa.pham@giasucenter.vn', 'tutor123', '0902000003',
            'Phạm Thanh Hoa', 'F', date(1999, 1, 8), 'Thủ Đức, TP.HCM',
            'Đại học Ngoại thương', 'Kinh tế đối ngoại', 'Tiếng Anh, IELTS', 'G6, G7, G8, G9, G10, G11, G12',
            'Thủ Đức, Quận 2, Bình Thạnh, Online', 'IELTS 7.5, chuyên kèm mất gốc và giao tiếp.', 4.8, True, '003'
        )
        tutor_4 = self.create_tutor(
            'tutor_4', 'khang.vo@giasucenter.vn', 'tutor123', '0902000004',
            'Võ Gia Khang', 'M', date(2000, 11, 2), 'Gò Vấp, TP.HCM',
            'Đại học Y Dược TP.HCM', 'Dược học', 'Hóa, Sinh', 'G9, G10, G11, G12',
            'Gò Vấp, Phú Nhuận, Tân Bình', 'Kèm Hóa - Sinh theo chương trình mới.', 4.5, True, '004'
        )
        tutor_pending = self.create_tutor(
            'tutor_pending', 'pending.tutor@giasucenter.vn', 'tutor123', '0902000005',
            'Đặng Nhật Nam', 'M', date(2001, 7, 14), 'Quận 10, TP.HCM',
            'Đại học Bách Khoa', 'Kỹ thuật điện', 'Vật lý, Toán', 'G10, G11',
            'Quận 10, Quận 5', 'Hồ sơ mới đăng ký, chờ xét duyệt.', 0, False, '005'
        )
        tutor_pending.user.status = 'inactive'
        tutor_pending.user.save(update_fields=['status', 'updated_at'])

        self.add_availability(tutor_1, [
            ('MONDAY', '17:30', '21:00'), ('WEDNESDAY', '17:30', '21:00'), ('SATURDAY', '08:00', '11:30')
        ])
        self.add_availability(tutor_2, [
            ('TUESDAY', '18:00', '21:00'), ('THURSDAY', '18:00', '21:00'), ('SUNDAY', '09:00', '11:00')
        ])
        self.add_availability(tutor_3, [
            ('MONDAY', '19:00', '21:00'), ('FRIDAY', '18:00', '21:00'), ('SATURDAY', '14:00', '17:00')
        ])
        self.add_availability(tutor_4, [
            ('TUESDAY', '17:00', '20:00'), ('THURSDAY', '17:00', '20:00'), ('SUNDAY', '14:00', '17:00')
        ])
        self.add_availability(tutor_pending, [('MONDAY', '18:00', '20:00')])

        self.add_qualifications(tutor_1, [
            ('DEGREE', 'Bằng cử nhân Sư phạm Toán', 'APPROVED', 'Tốt nghiệp loại giỏi.'),
            ('CERTIFICATE', 'Chứng chỉ nghiệp vụ sư phạm', 'APPROVED', 'Đã xác minh bản scan.'),
        ])
        self.add_qualifications(tutor_2, [
            ('DEGREE', 'Bằng cử nhân CNTT', 'APPROVED', 'Đại học KHTN.'),
            ('CERTIFICATE', 'Chứng chỉ Python nâng cao', 'PENDING_REVIEW', 'Chờ nhân viên duyệt.'),
        ])
        self.add_qualifications(tutor_3, [
            ('CERTIFICATE', 'IELTS 7.5', 'APPROVED', 'Còn hiệu lực.'),
        ])
        self.add_qualifications(tutor_4, [
            ('TRANSCRIPT', 'Bảng điểm chuyên ngành Dược', 'PENDING_REVIEW', 'Cần đối chiếu thêm.'),
        ])
        self.add_qualifications(tutor_pending, [
            ('DEGREE', 'Giấy xác nhận sinh viên', 'PENDING_REVIEW', 'Hồ sơ mới đăng ký.'),
        ])

        student_1 = self.create_student(
            'student1', 'mai.pham@example.com', 'student123', '0903000001', 'Nguyễn Văn An', 'M', date(2009, 3, 15),
            'G10', 'THPT Gia Định', 'Phạm Thị Mai', 'Bình Thạnh, TP.HCM', 'Cần củng cố Toán và Lý.'
        )
        student_2 = self.create_student(
            'student2', 'huong.le@example.com', 'student123', '0903000002', 'Lê Minh Châu', 'F', date(2011, 8, 4),
            'G8', 'THCS Nguyễn Du', 'Lê Thu Hương', 'Quận 3, TP.HCM', 'Muốn học Tiếng Anh giao tiếp.'
        )
        student_3 = self.create_student(
            'student3', 'tuan.do@example.com', 'student123', '0903000003', 'Đỗ Hải Nam', 'M', date(2008, 12, 19),
            'G11', 'THPT Marie Curie', 'Đỗ Anh Tuấn', 'Quận 7, TP.HCM', 'Cần luyện Hóa học mất gốc.'
        )
        student_4 = self.create_student(
            'student4', 'nhi.vo@example.com', 'student123', '0903000004', 'Võ Ngọc Nhi', 'F', date(2012, 4, 22),
            'G7', 'THCS Lê Quý Đôn', 'Võ Thanh Bình', 'Thủ Đức, TP.HCM', 'Cần học kèm Toán cơ bản.'
        )

        c_staff_pending = self.create_class(
            student_1.user, 'Toán lớp 10', 'G10', 'Thứ 3 18:00-19:30, Thứ 5 18:00-19:30', 2,
            2800000, 3800000, 'Bình Thạnh, TP.HCM', 'Học sinh cần lấy lại căn bản đại số.', 'open', start_offset=5, hourly=220000
        )
        c_pending_admin = self.create_class(
            staff_1, 'Tiếng Anh lớp 8', 'G8', 'Thứ 2 19:00-20:30, Thứ 6 19:00-20:30', 2,
            2400000, 3400000, 'Quận 3, TP.HCM', 'Ưu tiên gia sư nữ, phát âm tốt.', 'open', start_offset=3, hourly=200000,
            admin_note='Nhân viên đã kiểm tra thông tin, chờ admin duyệt công khai.'
        )
        c_open_math = self.create_class(
            staff_1, 'Toán luyện thi THPT', 'G12', 'Thứ 2 18:00-19:30, Thứ 4 18:00-19:30', 2,
            3500000, 4800000, 'Quận 1, TP.HCM', 'Cần gia sư có kinh nghiệm luyện đề tốt nghiệp.', 'open', start_offset=7, hourly=260000
        )
        c_open_english = self.create_class(
            staff_2, 'Tiếng Anh giao tiếp', 'G9', 'Thứ 7 14:00-15:30, Chủ nhật 09:00-10:30', 2,
            2600000, 3600000, 'Online', 'Tập trung phản xạ giao tiếp và phát âm.', 'open', start_offset=10, mode='online', hourly=220000
        )
        c_open_chem = self.create_class(
            staff_2, 'Hóa học lớp 11', 'G11', 'Thứ 3 17:30-19:00, Thứ 5 17:30-19:00', 2,
            3000000, 4200000, 'Gò Vấp, TP.HCM', 'Ôn chương cân bằng phản ứng và hữu cơ.', 'open', start_offset=12, hourly=240000
        )
        c_waiting_parent = self.create_class(
            staff_1, 'Hóa học mất gốc', 'G11', 'Thứ 3 18:00-19:30, Thứ 5 18:00-19:30', 2,
            3000000, 4200000, 'Quận 7, TP.HCM', 'Phụ huynh cần xác nhận gia sư được đề xuất.', 'teaching', tutor=tutor_4, start_offset=2, hourly=240000
        )
        c_waiting_tutor = self.create_class(
            staff_2, 'Tin học Python cơ bản', 'G10', 'Thứ 3 19:30-21:00, Chủ nhật 09:00-10:30', 2,
            3200000, 4500000, 'Online', 'Chờ gia sư xác nhận lịch dạy.', 'teaching', tutor=tutor_2, start_offset=1, mode='online', hourly=250000
        )
        c_assigned = self.create_class(
            staff_1, 'Vật lý lớp 10', 'G10', 'Thứ 7 08:00-09:30', 1,
            2200000, 3100000, 'Bình Thạnh, TP.HCM', 'Đã phân công gia sư, chuẩn bị khai giảng.', 'teaching', tutor=tutor_1, start_offset=4, hourly=210000
        )
        c_teaching_math = self.create_class(
            staff_1, 'Toán lớp 11', 'G11', 'Thứ 2 18:00-19:30, Thứ 4 18:00-19:30', 2,
            3200000, 4500000, 'Quận 1, TP.HCM', 'Lớp đang học ổn định.', 'teaching', tutor=tutor_1, start_offset=-20, hourly=250000
        )
        c_teaching_python = self.create_class(
            staff_2, 'Lập trình Python cho học sinh', 'G10', 'Thứ 3 18:00-19:30, Thứ 5 18:00-19:30', 2,
            3400000, 4700000, 'Online', 'Lớp đang học, cần theo dõi nhật ký buổi học.', 'teaching', tutor=tutor_2, start_offset=-15, mode='online', hourly=260000
        )
        c_paused = self.create_class(
            staff_2, 'IELTS Foundation', 'G10', 'Thứ 6 18:30-20:00', 1,
            2800000, 3900000, 'Thủ Đức, TP.HCM', 'Tạm dừng 1 tuần do học viên bận thi.', 'teaching', tutor=tutor_3, start_offset=-25, hourly=230000
        )
        c_completed = self.create_class(
            staff_1, 'Toán lớp 9', 'G9', 'Thứ 7 09:30-11:00', 1,
            2200000, 3200000, 'Bình Thạnh, TP.HCM', 'Lớp đã hoàn thành, có đánh giá.', 'completed', tutor=tutor_1, start_offset=-70, total_sessions=12, hourly=200000
        )
        c_cancelled = self.create_class(
            staff_1, 'Sinh học lớp 12', 'G12', 'Chủ nhật 14:00-15:30', 1,
            2500000, 3500000, 'Quận 10, TP.HCM', 'Phụ huynh hủy nhu cầu do đổi lịch.', 'cancelled', start_offset=-5, hourly=220000
        )

        enrollments = [
            self.enroll(c_staff_pending, student_1, 'unpaid'),
            self.enroll(c_pending_admin, student_2, 'unpaid'),
            self.enroll(c_waiting_parent, student_3, 'paid'),
            self.enroll(c_waiting_tutor, student_1, 'paid'),
            self.enroll(c_assigned, student_1, 'active'),
            self.enroll(c_teaching_math, student_1, 'active'),
            self.enroll(c_teaching_python, student_2, 'paid'),
            self.enroll(c_paused, student_2, 'active'),
            self.enroll(c_completed, student_4, 'completed'),
            self.enroll(c_cancelled, student_3, 'dropped'),
        ]
        for enrollment in enrollments:
            self.add_tuition_transaction(enrollment)

        ClassApplication.objects.create(
            tutor=tutor_2,
            class_obj=c_open_english,
            cover_note='Em có kinh nghiệm dạy online và có thể bắt đầu ngay.',
            expected_salary=Decimal('2700000'),
            available_schedule_note='Rảnh cuối tuần theo lịch lớp.',
            status='PENDING',
        )
        ClassApplication.objects.create(
            tutor=tutor_1,
            class_obj=c_open_math,
            cover_note='Đã dạy nhiều lớp luyện thi THPT.',
            expected_salary=Decimal('3600000'),
            available_schedule_note='Rảnh Thứ 2 và Thứ 4 buổi tối.',
            status='PENDING',
        )
        ClassApplication.objects.create(
            tutor=tutor_4,
            class_obj=c_waiting_parent,
            cover_note='Nhân viên đề xuất gia sư Hóa phù hợp.',
            expected_salary=c_waiting_parent.salary_per_month,
            available_schedule_note='Đúng lịch phụ huynh yêu cầu.',
            status='APPROVED',
            reviewed_at=timezone.now(),
        )
        ClassApplication.objects.create(
            tutor=tutor_2,
            class_obj=c_waiting_tutor,
            cover_note='Gia sư đang xác nhận lớp Python.',
            expected_salary=c_waiting_tutor.salary_per_month,
            available_schedule_note='Có thể dạy online.',
            status='APPROVED',
            reviewed_at=timezone.now(),
        )
        ClassApplication.objects.create(
            tutor=tutor_3,
            class_obj=c_open_math,
            cover_note='Muốn nhận thêm lớp Toán.',
            expected_salary=Decimal('3400000'),
            available_schedule_note='Chỉ rảnh tối thứ 6.',
            status='REJECTED',
            reviewed_at=timezone.now(),
            rejection_reason='Không khớp chuyên môn chính.',
        )

        self.add_logs(tutor_1, c_teaching_math, [0, 2], [
            'Hàm số bậc hai', 'Phương trình lượng giác cơ bản', 'Luyện bài tập đạo hàm',
            'Ôn tập kiểm tra 45 phút', 'Chữa đề tổng hợp', 'Hệ phương trình', 'Hình học không gian', 'Bài tập nâng cao'
        ], confirmed_count=6)
        self.add_logs(tutor_2, c_teaching_python, [1, 3], [
            'Biến và kiểu dữ liệu', 'Câu lệnh điều kiện', 'Vòng lặp for/while', 'Danh sách trong Python',
            'Hàm cơ bản', 'Bài tập mini project', 'Xử lý chuỗi', 'Ôn tập'
        ], confirmed_count=5)
        self.add_logs(tutor_1, c_completed, [5], [
            'Tổng ôn đại số', 'Tổng ôn hình học', 'Chữa đề cuối khóa', 'Đánh giá kết quả'
        ], confirmed_count=4)

        AbsenceRequest.objects.create(
            tutor=tutor_1,
            class_obj=c_teaching_math,
            session_date=self.next_date_for_weekday(0),
            reason='Gia sư có lịch thi cao học.',
            request_type='ABSENCE_WITH_MAKEUP',
            proposed_makeup_date=self.next_date_for_weekday(5),
            proposed_start_time=time(8, 0),
            proposed_end_time=time(9, 30),
            status='PENDING',
            note='Đề xuất học bù cuối tuần.',
        )
        AbsenceRequest.objects.create(
            tutor=tutor_2,
            class_obj=c_teaching_python,
            session_date=self.next_date_for_weekday(3),
            reason='Mất điện khu vực gia sư.',
            request_type='RESCHEDULE',
            proposed_makeup_date=self.next_date_for_weekday(6),
            proposed_start_time=time(9, 0),
            proposed_end_time=time(10, 30),
            status='APPROVED',
            admin_note='Đã thông báo phụ huynh.',
        )
        AbsenceRequest.objects.create(
            tutor=tutor_3,
            class_obj=c_paused,
            session_date=self.next_date_for_weekday(4),
            reason='Học viên bận thi học kỳ.',
            request_type='ABSENCE_ONLY',
            status='PENDING',
        )

        RefundRequest.objects.create(
            tutor=tutor_1,
            class_obj=c_teaching_math,
            receiving_fee_id='RF-T1-001',
            amount=Decimal('350000'),
            reason='Hoàn phí nhận lớp do lớp đổi lịch một buổi.',
            bank_name='MB Bank',
            account_number=tutor_1.bank_account_number,
            account_holder=tutor_1.full_name,
            status='PENDING',
        )
        RefundRequest.objects.create(
            tutor=tutor_2,
            class_obj=c_teaching_python,
            receiving_fee_id='RF-T2-001',
            amount=Decimal('300000'),
            approved_amount=Decimal('250000'),
            reason='Điều chỉnh phí nhận lớp online.',
            bank_name='MB Bank',
            account_number=tutor_2.bank_account_number,
            account_holder=tutor_2.full_name,
            status='COMPLETED',
            admin_note='Đã hoàn tất chuyển khoản.',
        )

        Transaction.objects.create(user_id=tutor_1.user, enrollment_id=enrollments[5], amount=Decimal('450000'), type='commission', status='success')
        Transaction.objects.create(user_id=tutor_2.user, enrollment_id=enrollments[6], amount=Decimal('470000'), type='commission', status='pending')
        Transaction.objects.create(user_id=tutor_4.user, enrollment_id=enrollments[2], amount=Decimal('420000'), type='commission', status='pending')
        Transaction.objects.create(user_id=tutor_1.user, amount=Decimal('3200000'), type='tutor_salary', status='success')
        Transaction.objects.create(user_id=tutor_2.user, amount=Decimal('3400000'), type='tutor_salary', status='pending')
        Transaction.objects.create(user_id=student_3.user, enrollment_id=enrollments[9], amount=Decimal('1500000'), type='refund', status='success')

        Review.objects.create(class_id=c_teaching_math, user_id=student_1.user, star_rating=5, comment='Gia sư dạy dễ hiểu, theo sát bài tập của con.')
        Review.objects.create(class_id=c_teaching_python, user_id=student_2.user, star_rating=5, comment='Lớp online nhưng tương tác tốt, con rất thích học Python.')
        Review.objects.create(class_id=c_completed, user_id=student_4.user, star_rating=4, comment='Hoàn thành đúng lộ trình, điểm kiểm tra có cải thiện.')
        Review.objects.create(class_id=c_paused, user_id=student_2.user, star_rating=4, comment='Gia sư nhiệt tình, cần thêm tài liệu luyện tập.')

        return {
            'users': User.objects.count(),
            'staff': User.objects.filter(role='staff').count(),
            'tutors': Tutor.objects.count(),
            'students': Student.objects.count(),
            'classes': Class.objects.count(),
            'enrollments': Enrollment.objects.count(),
            'transactions': Transaction.objects.count(),
            'reviews': Review.objects.count(),
            'applications': ClassApplication.objects.count(),
            'absence_requests': AbsenceRequest.objects.count(),
            'refund_requests': RefundRequest.objects.count(),
        }

    def print_summary(self, data):
        self.stdout.write(self.style.SUCCESS('Database seeding completed!'))
        self.stdout.write(self.style.SUCCESS('Demo accounts:'))
        self.stdout.write(self.style.SUCCESS('  admin / admin123'))
        self.stdout.write(self.style.SUCCESS('  staff_1 / staff123'))
        self.stdout.write(self.style.SUCCESS('  staff_2 / staff123'))
        self.stdout.write(self.style.SUCCESS('  tutor_1 / tutor123'))
        self.stdout.write(self.style.SUCCESS('  tutor_2 / tutor123'))
        self.stdout.write(self.style.SUCCESS('  tutor_3 / tutor123'))
        self.stdout.write(self.style.SUCCESS('  student1 / student123'))
        self.stdout.write(self.style.SUCCESS('  student2 / student123'))
        self.stdout.write(self.style.SUCCESS('Counts:'))
        for key, value in data.items():
            self.stdout.write(self.style.SUCCESS(f'  {key}: {value}'))

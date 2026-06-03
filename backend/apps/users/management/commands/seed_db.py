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
    help = 'Seed database with concise synchronized demo data for the tutor center project'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear all data before seeding')

    def handle(self, *args, **options):
        if options['clear']:
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

        if User.objects.filter(username='admin').exists():
            self.stdout.write(self.style.WARNING('Database already has admin user. Use --clear to recreate demo data.'))
            return

        self.stdout.write(self.style.SUCCESS('Creating synchronized demo data...'))

        admin = User.objects.create_superuser(
            username='admin', email='admin@giasucenter.vn', password='admin123',
            role='admin', phone='0901000000', status='active', first_name='Nguyễn Văn Admin'
        )

        staff1 = User.objects.create_user(
            username='staff', email='tran.thi.huong@giasucenter.vn', password='staff123',
            role='staff', phone='0901000001', status='active', is_staff=True,
            first_name='Trần Thị Hương'
        )
        staff2 = User.objects.create_user(
            username='staff_2', email='le.van.nam@giasucenter.vn', password='staff123',
            role='staff', phone='0901000002', status='inactive', is_staff=False,
            is_active=True, first_name='Lê Văn Nam'
        )

        tutor_user1 = User.objects.create_user(
            username='tutor_1', email='nguyen.thi.lan@gmail.com', password='tutor123',
            role='tutor', phone='0902000001', status='active', first_name='Nguyễn Thị Lan'
        )
        tutor1 = Tutor.objects.create(
            user=tutor_user1,
            full_name='Nguyễn Thị Lan',
            gender='F',
            birthday=date(1998, 5, 12),
            address='Quận 1, TP.HCM',
            university='Đại học Sư phạm TP.HCM',
            major='Sư phạm Toán',
            teachable_subjects='Toán',
            teachable_grades='Lớp 10',
            teaching_areas='Quận 1, Quận 3, Bình Thạnh',
            experience_summary='Có 5 năm kinh nghiệm dạy kèm Toán lớp 10, thường xuyên trao đổi tiến độ học tập với phụ huynh.',
            rating=4.9,
            is_verified=True,
        )
        tutor_user2 = User.objects.create_user(
            username='tutor_2', email='tran.van.minh@gmail.com', password='tutor123',
            role='tutor', phone='0902000002', status='inactive', is_active=True,
            first_name='Trần Văn Minh'
        )
        tutor2 = Tutor.objects.create(
            user=tutor_user2,
            full_name='Trần Văn Minh',
            gender='M',
            birthday=date(1997, 10, 20),
            address='Quận 3, TP.HCM',
            university='Đại học Khoa học Tự nhiên TP.HCM',
            major='Vật lý ứng dụng',
            teachable_subjects='Vật lý',
            teachable_grades='Lớp 11',
            teaching_areas='Quận 3, Quận 5, Quận 10',
            experience_summary='Có 4 năm kinh nghiệm dạy Vật lý lớp 11 và luyện kiểm tra định kỳ.',
            rating=4.7,
            is_verified=False,
        )

        TutorQualification.objects.bulk_create([
            TutorQualification(tutor=tutor1, document_type='DEGREE', title='Cử nhân Sư phạm Toán', description='Bằng đại học đã xác minh', status='APPROVED'),
            TutorQualification(tutor=tutor1, document_type='CERTIFICATE', title='Chứng chỉ nghiệp vụ sư phạm', description='Chứng chỉ bổ sung', status='APPROVED'),
            TutorQualification(tutor=tutor2, document_type='DEGREE', title='Cử nhân Vật lý ứng dụng', description='Đang chờ admin duyệt', status='PENDING_REVIEW'),
        ])
        TutorAvailability.objects.bulk_create([
            TutorAvailability(tutor=tutor1, day_of_week='MONDAY', start_time='17:00', end_time='19:00'),
            TutorAvailability(tutor=tutor1, day_of_week='WEDNESDAY', start_time='19:00', end_time='21:00'),
            TutorAvailability(tutor=tutor1, day_of_week='FRIDAY', start_time='17:00', end_time='19:00'),
            TutorAvailability(tutor=tutor2, day_of_week='TUESDAY', start_time='18:00', end_time='20:00'),
            TutorAvailability(tutor=tutor2, day_of_week='THURSDAY', start_time='18:00', end_time='20:00'),
        ])

        student_user1 = User.objects.create_user(
            username='student1', email='pham.thi.mai@gmail.com', password='student123',
            role='student', phone='0903000001', status='active', first_name='Nguyễn Văn An'
        )
        student_user2 = User.objects.create_user(
            username='student2', email='nguyen.van.binh@gmail.com', password='student123',
            role='student', phone='0903000002', status='active', first_name='Nguyễn Thị Bình'
        )
        student_user3 = User.objects.create_user(
            username='student3', email='le.minh.khang@gmail.com', password='student123',
            role='student', phone='0903000003', status='active', first_name='Lê Minh Khang'
        )

        student1 = Student.objects.create(user=student_user1, full_name='Nguyễn Văn An', gender='M', birthday=date(2009, 3, 15), grade_level='G10', school_name='THPT Gia Định', note='Cần củng cố Toán và luyện bài tập theo chương trình trên lớp.', parent_name='Phạm Thị Mai', parent_phone='0903000001', parent_email='pham.thi.mai@gmail.com')
        student2 = Student.objects.create(user=student_user2, full_name='Nguyễn Thị Bình', gender='F', birthday=date(2008, 7, 8), grade_level='G11', school_name='THPT Trưng Vương', note='Cần hỗ trợ Vật lý nâng cao.', parent_name='Phạm Thị Mai', parent_phone='0903000001', parent_email='pham.thi.mai@gmail.com')
        student3 = Student.objects.create(user=student_user3, full_name='Lê Minh Khang', gender='M', birthday=date(2007, 11, 1), grade_level='G12', school_name='THPT Nguyễn Thượng Hiền', note='Ôn thi tốt nghiệp môn Hóa học.', parent_name='Nguyễn Văn Bình', parent_phone='0903000002', parent_email='nguyen.van.binh@gmail.com')

        cls1 = Class.objects.create(
            tutor=tutor1, created_by=staff1, subject_name='Toán lớp 10', grade_level='Lớp 10',
            schedule_detail='Thứ 2, Thứ 4, Thứ 6 - 19:00', sessions_per_week=3,
            salary_per_month=Decimal('4800000'), tuition_fee=Decimal('6000000'),
            address_teaching='Quận Bình Thạnh, TP.HCM', requirements='Củng cố kiến thức nền và luyện bài tập.', status='teaching'
        )
        cls2 = Class.objects.create(
            tutor=tutor2, created_by=staff1, subject_name='Vật lý lớp 11', grade_level='Lớp 11',
            schedule_detail='Thứ 3, Thứ 5 - 18:00', sessions_per_week=2,
            salary_per_month=Decimal('4000000'), tuition_fee=Decimal('5200000'),
            address_teaching='Quận 3, TP.HCM', requirements='Luyện bài tập và chuẩn bị kiểm tra định kỳ.', status='teaching'
        )
        cls3 = Class.objects.create(
            tutor=None, created_by=staff1, subject_name='Hóa học lớp 12', grade_level='Lớp 12',
            schedule_detail='Thứ 7 - 17:00', sessions_per_week=1,
            salary_per_month=Decimal('2400000'), tuition_fee=Decimal('3200000'),
            address_teaching='TP. Thủ Đức, TP.HCM', requirements='Cần gia sư ôn thi tốt nghiệp.', status='open'
        )
        cls4 = Class.objects.create(
            tutor=None, created_by=staff2, subject_name='Tiếng Anh lớp 8', grade_level='Lớp 8',
            schedule_detail='Thứ 2, Thứ 5 - 18:30', sessions_per_week=2,
            salary_per_month=Decimal('3200000'), tuition_fee=Decimal('4200000'),
            address_teaching='Quận 10, TP.HCM', requirements='Lớp mới nhân viên công khai để gia sư đăng ký nhận lớp.', status='open'
        )
        cls5 = Class.objects.create(
            tutor=tutor1, created_by=staff1, subject_name='Toán lớp 12', grade_level='Lớp 12',
            schedule_detail='Chủ nhật - 09:00', sessions_per_week=1,
            salary_per_month=Decimal('2600000'), tuition_fee=Decimal('3500000'),
            address_teaching='Quận 1, TP.HCM', requirements='Khóa học đã hoàn thành.', status='completed'
        )
        cls6 = Class.objects.create(
            tutor=tutor2, created_by=staff2, subject_name='Tiếng Anh lớp 8', grade_level='Lớp 8',
            schedule_detail='Thứ 6 - 19:00', sessions_per_week=1,
            salary_per_month=Decimal('2200000'), tuition_fee=Decimal('3000000'),
            address_teaching='Quận Bình Thạnh, TP.HCM', requirements='Nhân viên đã gửi gia sư phù hợp, đang chờ phụ huynh xác nhận.', status='waiting_parent'
        )

        enrollments = [
            Enrollment.objects.create(class_id=cls1, student_id=student1, status='active'),
            Enrollment.objects.create(class_id=cls2, student_id=student2, status='active'),
            Enrollment.objects.create(class_id=cls3, student_id=student3, status='unpaid'),
            Enrollment.objects.create(class_id=cls4, student_id=student3, status='unpaid'),
            Enrollment.objects.create(class_id=cls5, student_id=student3, status='completed'),
            Enrollment.objects.create(class_id=cls6, student_id=student2, status='unpaid'),
        ]

        payment_rows = [
            (student_user1, enrollments[0], cls1.tuition_fee, 'tuition_fee', 'success'),
            (student_user2, enrollments[1], cls2.tuition_fee, 'tuition_fee', 'pending'),
            (student_user3, enrollments[2], cls3.tuition_fee, 'tuition_fee', 'pending'),
            (student_user3, enrollments[4], cls5.tuition_fee, 'tuition_fee', 'success'),
            (student_user2, enrollments[5], cls6.tuition_fee, 'tuition_fee', 'pending'),
            (student_user1, enrollments[0], Decimal('1200000'), 'commission', 'success'),
            (student_user3, enrollments[4], Decimal('900000'), 'commission', 'success'),
            (tutor1.user, enrollments[0], cls1.salary_per_month, 'tutor_salary', 'success'),
            (tutor2.user, enrollments[1], cls2.salary_per_month, 'tutor_salary', 'pending'),
            (tutor1.user, enrollments[4], cls5.salary_per_month, 'tutor_salary', 'success'),
        ]
        for user, enrollment, amount, tx_type, tx_status in payment_rows:
            Transaction.objects.create(user_id=user, enrollment_id=enrollment, amount=amount, type=tx_type, status=tx_status)

        today = timezone.localdate()
        for idx in range(1, 9):
            TeachingLog.objects.create(
                tutor=tutor1, class_obj=cls1, session_date=today - timedelta(days=idx),
                start_time=time(19, 0), end_time=time(20, 30), topic=f'Buổi {idx}: Ôn tập Toán',
                content='Gia sư đã dạy theo giáo án và giao bài tập về nhà.', student_understanding_level='GOOD',
                attendance_status='PRESENT', homework='Hoàn thành bài tập trong sách.', note='Học viên tiến bộ tốt.'
            )
        for idx in range(1, 5):
            TeachingLog.objects.create(
                tutor=tutor2, class_obj=cls2, session_date=today - timedelta(days=idx * 2),
                start_time=time(18, 0), end_time=time(19, 30), topic=f'Buổi {idx}: Luyện Vật lý',
                content='Ôn công thức và luyện bài tập vận dụng.', student_understanding_level='GOOD',
                attendance_status='PRESENT', homework='Làm bài tập chương Điện học.', note='Cần kiểm tra lại công thức.'
            )

        ClassApplication.objects.create(tutor=tutor1, class_obj=cls3, cover_note='Em phù hợp lớp Hóa 12 vì có thể hỗ trợ bài tập nền tảng.', expected_salary=Decimal('2400000'), available_schedule_note='Tối thứ 7', status='PENDING')
        ClassApplication.objects.create(tutor=tutor2, class_obj=cls3, cover_note='Em có kinh nghiệm dạy Hóa và Vật lý THPT.', expected_salary=Decimal('2400000'), available_schedule_note='Tối thứ 7', status='PENDING')
        ClassApplication.objects.create(tutor=tutor2, class_obj=cls6, cover_note='Nhân viên đã gửi gia sư này cho phụ huynh xác nhận.', expected_salary=Decimal('2200000'), available_schedule_note='Tối thứ 6', status='APPROVED', reviewed_at=timezone.now())

        Review.objects.create(class_id=cls1, user_id=student_user1, star_rating=5, comment='Gia sư dạy dễ hiểu, học viên tiến bộ rõ rệt.')
        Review.objects.create(class_id=cls2, user_id=student_user2, star_rating=4, comment='Gia sư nhiệt tình, cần tăng thêm bài tập nâng cao.')
        Review.objects.create(class_id=cls5, user_id=student_user3, star_rating=5, comment='Khóa học hoàn thành đúng tiến độ, phụ huynh hài lòng.')

        self.stdout.write(self.style.SUCCESS('Database seeding completed!'))
        self.stdout.write(self.style.SUCCESS('Demo accounts:'))
        self.stdout.write(self.style.SUCCESS('  admin / admin123'))
        self.stdout.write(self.style.SUCCESS('  staff / staff123'))
        self.stdout.write(self.style.SUCCESS('  tutor_1 / tutor123'))
        self.stdout.write(self.style.SUCCESS('  student1 / student123'))
        self.stdout.write(self.style.SUCCESS('Created: 1 admin, 2 staff, 2 tutors, 3 students, 6 classes.'))

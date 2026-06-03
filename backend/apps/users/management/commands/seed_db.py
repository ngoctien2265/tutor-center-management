from datetime import date

from django.core.management.base import BaseCommand

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
    help = 'Seed database with minimal demo accounts for the tutor center project'

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

        self.stdout.write(self.style.SUCCESS('Creating minimal demo data...'))

        User.objects.create_superuser(
            username='admin',
            email='admin@giasucenter.vn',
            password='admin123',
            role='admin',
            phone='0901000000',
            status='active',
            first_name='Nguyễn Văn Admin',
        )

        tutor_user = User.objects.create_user(
            username='tutor_1',
            email='nguyen.thi.lan@gmail.com',
            password='tutor123',
            role='tutor',
            phone='0902000001',
            status='active',
            first_name='Nguyễn Thị Lan',
        )
        Tutor.objects.create(
            user=tutor_user,
            full_name='Nguyễn Thị Lan',
            gender='F',
            birthday=date(1998, 5, 12),
            address='Quận 1, TP.HCM',
            university='Đại học Sư phạm TP.HCM',
            major='Sư phạm Toán',
            teachable_subjects='Toán',
            teachable_grades='Lớp 10',
            teaching_areas='Quận 1, Quận 3, Bình Thạnh',
            experience_summary='Có kinh nghiệm dạy kèm Toán THPT.',
            rating=4.9,
            is_verified=True,
        )

        student_user = User.objects.create_user(
            username='student1',
            email='pham.thi.mai@gmail.com',
            password='student123',
            role='student',
            phone='0903000001',
            status='active',
            first_name='Nguyễn Văn An',
        )
        Student.objects.create(
            user=student_user,
            full_name='Nguyễn Văn An',
            gender='M',
            birthday=date(2009, 3, 15),
            grade_level='G10',
            school_name='THPT Gia Định',
            note='Cần củng cố kiến thức Toán.',
            parent_name='Phạm Thị Mai',
            parent_phone='0903000001',
            parent_email='pham.thi.mai@gmail.com',
        )

        self.stdout.write(self.style.SUCCESS('Database seeding completed!'))
        self.stdout.write(self.style.SUCCESS('Demo accounts:'))
        self.stdout.write(self.style.SUCCESS('  admin / admin123'))
        self.stdout.write(self.style.SUCCESS('  tutor_1 / tutor123'))
        self.stdout.write(self.style.SUCCESS('  student1 / student123'))
        self.stdout.write(self.style.SUCCESS('Created: 1 admin, 1 tutor, 1 student.'))

# Generated for tutoring center payment workflow
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='enrollment',
            name='status',
            field=models.CharField(choices=[('unpaid', 'Chưa thanh toán'), ('paid', 'Đã thanh toán'), ('overdue', 'Quá hạn'), ('active', 'Đang học'), ('dropped', 'Đã dừng'), ('completed', 'Hoàn thành')], default='unpaid', max_length=20),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='type',
            field=models.CharField(choices=[('tuition_fee', 'Học phí'), ('tutor_salary', 'Lương gia sư'), ('commission', 'Hoa hồng trung tâm'), ('refund', 'Hoàn tiền')], max_length=20),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='status',
            field=models.CharField(choices=[('pending', 'Chờ xác nhận'), ('success', 'Đã thanh toán'), ('failed', 'Thất bại')], default='pending', max_length=20),
        ),
    ]

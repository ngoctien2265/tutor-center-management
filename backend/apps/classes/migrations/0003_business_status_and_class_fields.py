# Generated for tutoring center business workflow
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('classes', '0002_alter_class_status_pending_admin'),
    ]

    operations = [
        migrations.AddField(
            model_name='class',
            name='grade_level',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='class',
            name='tuition_fee',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='class',
            name='admin_note',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='class',
            name='status',
            field=models.CharField(choices=[('pending_admin', 'Chờ duyệt'), ('open', 'Đang tìm gia sư'), ('waiting_tutor', 'Chờ gia sư xác nhận'), ('assigned', 'Đã phân công gia sư'), ('teaching', 'Đang học'), ('paused', 'Tạm dừng'), ('completed', 'Hoàn thành'), ('cancelled', 'Đã hủy')], default='open', max_length=20),
        ),
    ]

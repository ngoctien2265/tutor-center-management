from django.db import migrations, models


def map_existing_statuses(apps, schema_editor):
    Class = apps.get_model('classes', 'Class')
    Class.objects.filter(status__in=['staff_pending', 'pending_admin']).update(status='open')
    Class.objects.filter(status__in=['waiting_parent', 'waiting_tutor', 'assigned', 'paused']).update(status='teaching')


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0008_alter_class_status'),
    ]

    operations = [
        migrations.RunPython(map_existing_statuses, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='class',
            name='status',
            field=models.CharField(
                choices=[
                    ('completed', 'Hoàn thành'),
                    ('cancelled', 'Đã hủy'),
                    ('teaching', 'Đang dạy'),
                    ('open', 'Đang tìm gia sư'),
                    ('waiting_student', 'Đang chờ học viên'),
                ],
                default='open',
                max_length=20,
            ),
        ),
    ]

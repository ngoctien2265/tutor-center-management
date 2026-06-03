from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0002_business_payment_statuses'),
        ('users', '0006_remove_parent_merge_to_student'),
    ]

    operations = [
        # Remove parent_id foreign key from Enrollment
        migrations.RemoveField(
            model_name='enrollment',
            name='parent_id',
        ),
    ]

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_remove_parent_merge_to_student'),
        ('finance', '0003_remove_enrollment_parent_id'),
    ]

    operations = [
        # Delete Parent model after all FK references to it have been removed
        migrations.DeleteModel(
            name='Parent',
        ),
    ]

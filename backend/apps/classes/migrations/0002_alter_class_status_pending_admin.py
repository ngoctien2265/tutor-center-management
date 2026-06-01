# Generated to add pending admin approval status for staff-created classes.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='class',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending_admin', 'Pending admin approval'),
                    ('open', 'Open'),
                    ('assigned', 'Assigned'),
                    ('teaching', 'Teaching'),
                    ('completed', 'Completed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='open',
                max_length=20,
            ),
        ),
    ]

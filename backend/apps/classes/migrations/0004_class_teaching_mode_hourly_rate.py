from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0003_business_status_and_class_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='class',
            name='teaching_mode',
            field=models.CharField(max_length=10, choices=[('online', 'Online'), ('offline', 'Offline')], default='offline'),
        ),
        migrations.AddField(
            model_name='class',
            name='expected_hourly_rate',
            field=models.DecimalField(max_digits=10, decimal_places=2, default=0),
        ),
    ]
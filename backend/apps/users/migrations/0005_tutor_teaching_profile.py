from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_auth_m2m_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='tutor',
            name='teachable_subjects',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tutor',
            name='teachable_grades',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tutor',
            name='teaching_areas',
            field=models.TextField(blank=True, null=True),
        ),
    ]

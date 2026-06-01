# Generated migration for classes app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Class',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_name', models.CharField(max_length=255)),
                ('schedule_detail', models.TextField(blank=True, null=True)),
                ('sessions_per_week', models.PositiveIntegerField(default=1)),
                ('salary_per_month', models.DecimalField(decimal_places=2, max_digits=10)),
                ('address_teaching', models.TextField(blank=True, null=True)),
                ('requirements', models.TextField(blank=True, null=True)),
                ('status', models.CharField(choices=[('open', 'Open'), ('assigned', 'Assigned'), ('teaching', 'Teaching'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='open', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='classes_created', to='users.user')),
                ('tutor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='classes_teaching', to='users.tutor')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='class',
            index=models.Index(fields=['status', 'tutor'], name='classes_cla_status_index'),
        ),
        migrations.AddIndex(
            model_name='class',
            index=models.Index(fields=['created_at'], name='classes_cla_created_index'),
        ),
    ]

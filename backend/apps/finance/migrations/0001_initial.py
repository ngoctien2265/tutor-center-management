# Generated migration for finance app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0001_initial'),
        ('classes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Enrollment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('unpaid', 'Pending Payment'), ('active', 'Active'), ('dropped', 'Dropped'), ('completed', 'Completed')], default='unpaid', max_length=20)),
                ('enrolled_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('class_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='enrollments', to='classes.class')),
                ('parent_id', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='enrollments', to='users.parent')),
                ('student_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='enrollments', to='users.student')),
            ],
            options={
                'ordering': ['-enrolled_at'],
            },
        ),
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('type', models.CharField(choices=[('tuition_fee', 'Tuition Fee'), ('commission', 'Commission'), ('refund', 'Refund')], max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('enrollment_id', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='finance.enrollment')),
                ('user_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='users.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['type', 'status'], name='finance_tra_type_status_index'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['user_id'], name='finance_tra_user_id_index'),
        ),
        migrations.AddIndex(
            model_name='enrollment',
            index=models.Index(fields=['status', 'class_id'], name='finance_enr_status_class_index'),
        ),
        migrations.AddIndex(
            model_name='enrollment',
            index=models.Index(fields=['student_id'], name='finance_enr_student_id_index'),
        ),
        migrations.AlterUniqueTogether(
            name='enrollment',
            unique_together={('class_id', 'student_id')},
        ),
    ]

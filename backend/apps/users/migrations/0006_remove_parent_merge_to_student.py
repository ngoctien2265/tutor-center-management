from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_tutor_teaching_profile'),
    ]

    operations = [
        # Add parent fields to Student model
        migrations.AddField(
            model_name='student',
            name='parent_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='student',
            name='parent_phone',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='student',
            name='parent_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='student',
            name='address',
            field=models.TextField(blank=True, null=True),
        ),
        # Make user field required in Student model
        migrations.AlterField(
            model_name='student',
            name='user',
            field=models.OneToOneField(
                on_delete=models.deletion.CASCADE,
                related_name='student_profile',
                to='users.user'
            ),
        ),
        # Remove parent foreign key from Student
        migrations.RemoveField(
            model_name='student',
            name='parent',
        ),
        # Note: Enrollment.parent_id is removed by finance.0003_remove_enrollment_parent_id
        # Update indexes
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='DROP INDEX IF EXISTS users_stud_parent_grade_index',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name='student',
                    name='users_stud_parent_grade_index',
                ),
            ],
        ),
        migrations.AddIndex(
            model_name='student',
            index=models.Index(fields=['grade_level'], name='users_stud_grade_level_idx'),
        ),
        migrations.AddIndex(
            model_name='student',
            index=models.Index(fields=['parent_phone'], name='users_stud_parent_phone_idx'),
        ),
        # Update User role choices (remove parent)
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Admin'),
                    ('staff', 'Staff'),
                    ('student', 'Student'),
                    ('tutor', 'Tutor'),
                ],
                max_length=20
            ),
        ),
        # Note: Parent model is deleted in users.0007 (after finance.0003_remove_enrollment_parent_id)
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_absencerequest_classapplication_refundrequest_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('admin', 'Admin'), ('staff', 'Staff'), ('student', 'Student'), ('tutor', 'Tutor'), ('parent', 'Parent')], max_length=20),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_alter_user_managers_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tutor',
            name='bank_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='tutor',
            name='bank_branch',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='tutor',
            name='bank_account_number',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]

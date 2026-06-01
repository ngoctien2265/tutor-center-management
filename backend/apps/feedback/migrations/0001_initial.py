# Generated migration for feedback app

from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0001_initial'),
        ('classes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Review',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('star_rating', models.IntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('comment', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('class_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='classes.class')),
                ('user_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews_given', to='users.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='review',
            index=models.Index(fields=['class_id', 'star_rating'], name='feedback_re_class_id_index'),
        ),
        migrations.AddIndex(
            model_name='review',
            index=models.Index(fields=['user_id'], name='feedback_re_user_id_index'),
        ),
        migrations.AlterUniqueTogether(
            name='review',
            unique_together={('class_id', 'user_id')},
        ),
    ]

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0003_project_key'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SprintRetro',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sprint_name', models.CharField(max_length=255)),
                ('summary', models.TextField(blank=True, default='')),
                ('wins', models.JSONField(default=list)),
                ('bottlenecks', models.JSONField(default=list)),
                ('repeated_blockers', models.JSONField(default=list)),
                ('scope_changes', models.JSONField(default=list)),
                ('workload_notes', models.JSONField(default=list)),
                ('patterns', models.JSONField(default=list)),
                ('action_items', models.JSONField(default=list)),
                ('confidence', models.CharField(
                    choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')],
                    default='medium',
                    max_length=10,
                )),
                ('confidence_reason', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sprint', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='retro',
                    to='projects.sprint',
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sprint_retros',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'sprint_retros'},
        ),
    ]

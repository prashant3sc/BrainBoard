import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProcessDefinition",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("process", "Process"),
                            ("standard", "Standard"),
                            ("runbook", "Runbook"),
                            ("checklist", "Checklist"),
                        ],
                        default="process",
                        max_length=20,
                    ),
                ),
                (
                    "trigger_contexts",
                    models.JSONField(
                        default=list,
                        help_text="List of trigger context keys, e.g. ['issue_view', 'bug']",
                    ),
                ),
                (
                    "issue_type_scope",
                    models.JSONField(
                        default=list,
                        help_text="Issue types this applies to. Empty list = all types.",
                    ),
                ),
                ("short_description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("priority", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_process_definitions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="process_definitions",
                        to="projects.project",
                    ),
                ),
                (
                    "wiki_page",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="process_definition",
                        to="wiki.wikipage",
                    ),
                ),
            ],
            options={
                "db_table": "process_definitions",
                "ordering": ["priority", "created_at"],
            },
        ),
    ]

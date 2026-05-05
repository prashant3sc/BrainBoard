import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("issues", "0007_add_comment_parent_fk"),
        ("projects", "0004_sprintretro"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ComplianceTemplate",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "applies_to",
                    models.CharField(
                        choices=[("task", "Task"), ("subtask", "Subtask"), ("bug", "Bug"), ("all", "All")],
                        default="all",
                        max_length=20,
                    ),
                ),
                ("blocks_on", models.CharField(blank=True, default="", max_length=100)),
                (
                    "required_role",
                    models.CharField(
                        choices=[
                            ("admin", "Admin"),
                            ("pm", "PM"),
                            ("developer", "Developer"),
                            ("viewer", "Viewer"),
                        ],
                        default="developer",
                        max_length=20,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="compliance_templates",
                        to="projects.project",
                    ),
                ),
            ],
            options={"db_table": "compliance_templates", "ordering": ["order", "created_at"]},
        ),
        migrations.CreateModel(
            name="ComplianceCheck",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("complete", "Complete"),
                            ("blocked", "Blocked"),
                            ("not_required", "Not Required"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("note", models.TextField(blank=True, default="")),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "completed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="completed_compliance_checks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "issue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="compliance_checks",
                        to="issues.issue",
                    ),
                ),
                (
                    "template",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="checks",
                        to="compliance.compliancetemplate",
                    ),
                ),
            ],
            options={
                "db_table": "compliance_checks",
                "ordering": ["template__order", "template__created_at"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="compliancecheck",
            unique_together={("issue", "template")},
        ),
    ]

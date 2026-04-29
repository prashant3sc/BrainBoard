import re
from django.db import migrations, models


def generate_project_keys(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    used_keys = set()

    for project in Project.objects.order_by('created_at'):
        # Build candidate from project name: uppercase letters/digits only, max 6 chars
        raw = re.sub(r'[^A-Z0-9]', '', project.name.upper())[:6]
        if not raw:
            raw = 'PROJ'

        candidate = raw
        suffix = 2
        # Ensure uniqueness within this backfill pass
        while candidate in used_keys:
            base = raw[:5] if len(raw) >= 5 else raw
            candidate = f"{base}{suffix}"
            suffix += 1

        project.key = candidate
        project.save(update_fields=['key'])
        used_keys.add(candidate)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0002_initial'),
    ]

    operations = [
        # Step 1: add nullable column
        migrations.AddField(
            model_name='project',
            name='key',
            field=models.CharField(blank=True, max_length=6, null=True),
        ),
        # Step 2: backfill existing rows
        migrations.RunPython(generate_project_keys, migrations.RunPython.noop),
        # Step 3: enforce unique constraint (all rows now have a value)
        migrations.AlterField(
            model_name='project',
            name='key',
            field=models.CharField(max_length=6, unique=True, null=True, blank=True),
        ),
    ]

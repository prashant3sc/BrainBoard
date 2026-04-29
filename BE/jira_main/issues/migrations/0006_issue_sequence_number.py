from django.db import migrations, models


def backfill_sequence_numbers(apps, schema_editor):
    Issue = apps.get_model('issues', 'Issue')
    Project = apps.get_model('projects', 'Project')

    for project in Project.objects.all():
        issues = Issue.objects.filter(project=project).order_by('created_at')
        for i, issue in enumerate(issues, start=1):
            issue.sequence_number = i
            issue.save(update_fields=['sequence_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('issues', '0005_add_comment_model'),
        ('projects', '0003_project_key'),
    ]

    operations = [
        # Step 1: add nullable column
        migrations.AddField(
            model_name='issue',
            name='sequence_number',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        # Step 2: backfill existing issues per project ordered by created_at
        migrations.RunPython(backfill_sequence_numbers, migrations.RunPython.noop),
        # Step 3: add unique_together constraint
        migrations.AlterUniqueTogether(
            name='issue',
            unique_together={('project', 'sequence_number')},
        ),
    ]

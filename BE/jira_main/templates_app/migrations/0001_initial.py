import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


SYSTEM_TEMPLATES = [
    # ── Project templates ──────────────────────────────────────────────────
    {
        "template_type": "project",
        "name": "Product Development",
        "description": "Full-cycle product team setup with roadmap wiki, standard labels, and 2-week sprints.",
        "icon": "🚀",
        "category": "development",
        "order": 0,
        "config": {
            "labels": [
                {"name": "Feature",       "color": "#0052CC"},
                {"name": "Bug",           "color": "#DE350B"},
                {"name": "Tech Debt",     "color": "#6554C0"},
                {"name": "UX",            "color": "#FF8B00"},
                {"name": "Documentation", "color": "#00875A"},
            ],
            "wiki_pages": [
                {
                    "title": "Product Roadmap",
                    "content": "<h1>Product Roadmap</h1><h2>Now</h2><p>What we are building this sprint.</p><h2>Next</h2><p>What comes after.</p><h2>Later</h2><p>Future ideas under evaluation.</p>",
                    "children": [],
                },
                {
                    "title": "Architecture Overview",
                    "content": "<h1>Architecture Overview</h1><h2>System Components</h2><p>Describe the major components here.</p><h2>Data Flow</h2><p>How data moves through the system.</p><h2>Key Decisions</h2><ul><li>Decision 1</li><li>Decision 2</li></ul>",
                    "children": [],
                },
                {
                    "title": "Team Norms",
                    "content": "<h1>Team Norms</h1><h2>Ways of Working</h2><ul><li>Default to async communication</li><li>PR review within 1 business day</li></ul><h2>Definition of Done</h2><ul><li>Code reviewed</li><li>Tests passing</li><li>Deployed to staging</li></ul>",
                    "children": [],
                },
            ],
            "sprint_defaults": {"duration_weeks": 2},
            "compliance_templates": [],
        },
    },
    {
        "template_type": "project",
        "name": "Mobile App",
        "description": "iOS/Android project with platform labels, release checklist wiki, and QA compliance gate.",
        "icon": "📱",
        "category": "mobile",
        "order": 1,
        "config": {
            "labels": [
                {"name": "iOS",         "color": "#0052CC"},
                {"name": "Android",     "color": "#00875A"},
                {"name": "Feature",     "color": "#6554C0"},
                {"name": "Bug",         "color": "#DE350B"},
                {"name": "Performance", "color": "#FF8B00"},
            ],
            "wiki_pages": [
                {
                    "title": "App Architecture",
                    "content": "<h1>App Architecture</h1><h2>Overview</h2><p>Describe the app structure.</p><h2>Navigation</h2><p>Screen hierarchy and routing.</p><h2>State Management</h2><p>How state is managed across the app.</p>",
                    "children": [],
                },
                {
                    "title": "Release Checklist",
                    "content": "<h1>Release Checklist</h1><h2>Pre-release</h2><ul><li>All P0/P1 bugs resolved</li><li>QA sign-off received</li><li>Store screenshots updated</li><li>Version bump committed</li></ul><h2>Post-release</h2><ul><li>Monitor crash rate for 24h</li><li>Notify stakeholders</li></ul>",
                    "children": [],
                },
                {
                    "title": "Device Testing Matrix",
                    "content": "<h1>Device Testing Matrix</h1><p>Track which devices and OS versions are validated for each release.</p><h2>iOS</h2><ul><li>iPhone 15 / iOS 17</li><li>iPhone 13 / iOS 16</li></ul><h2>Android</h2><ul><li>Pixel 8 / Android 14</li><li>Samsung S23 / Android 13</li></ul>",
                    "children": [],
                },
            ],
            "sprint_defaults": {"duration_weeks": 2},
            "compliance_templates": [
                {"name": "QA Sign-off", "applies_to": "all", "blocks_on": "done", "required_role": "developer"},
            ],
        },
    },
    {
        "template_type": "project",
        "name": "API Platform",
        "description": "Backend/API team setup with versioning policy, error codes wiki, and breaking-change labels.",
        "icon": "⚡",
        "category": "api",
        "order": 2,
        "config": {
            "labels": [
                {"name": "Breaking Change", "color": "#DE350B"},
                {"name": "Enhancement",     "color": "#0052CC"},
                {"name": "Bug",             "color": "#FF5630"},
                {"name": "Documentation",   "color": "#00875A"},
                {"name": "Performance",     "color": "#6554C0"},
            ],
            "wiki_pages": [
                {
                    "title": "API Reference",
                    "content": "<h1>API Reference</h1><h2>Base URL</h2><p><code>https://api.example.com/v1</code></p><h2>Authentication</h2><p>Bearer token in Authorization header.</p><h2>Endpoints</h2><p>Document endpoints here.</p>",
                    "children": [],
                },
                {
                    "title": "Error Codes",
                    "content": "<h1>Error Codes</h1><p>Standard error response shape: <code>{\"error\": \"...\", \"code\": \"...\"}</code></p><h2>Common Codes</h2><ul><li><strong>400</strong> — Bad request / validation error</li><li><strong>401</strong> — Unauthenticated</li><li><strong>403</strong> — Forbidden</li><li><strong>404</strong> — Resource not found</li><li><strong>429</strong> — Rate limit exceeded</li></ul>",
                    "children": [],
                },
                {
                    "title": "Versioning Policy",
                    "content": "<h1>Versioning Policy</h1><h2>Versioning Strategy</h2><p>We use URL versioning: <code>/v1/</code>, <code>/v2/</code>.</p><h2>Breaking Changes</h2><p>Breaking changes require a new major version and a 3-month deprecation notice.</p><h2>Deprecation Process</h2><ol><li>Add deprecation header to responses</li><li>Update documentation</li><li>Notify consumers</li><li>Remove after sunset date</li></ol>",
                    "children": [],
                },
            ],
            "sprint_defaults": {"duration_weeks": 2},
            "compliance_templates": [],
        },
    },
    {
        "template_type": "project",
        "name": "Security / Compliance",
        "description": "Security-focused setup with audit labels, incident response wiki, and mandatory security review gates.",
        "icon": "🔒",
        "category": "security",
        "order": 3,
        "config": {
            "labels": [
                {"name": "Critical",   "color": "#DE350B"},
                {"name": "High Risk",  "color": "#FF5630"},
                {"name": "Medium",     "color": "#FF8B00"},
                {"name": "Audit",      "color": "#6554C0"},
                {"name": "Policy",     "color": "#00875A"},
            ],
            "wiki_pages": [
                {
                    "title": "Security Policy",
                    "content": "<h1>Security Policy</h1><h2>Scope</h2><p>This policy applies to all systems and data handled by the team.</p><h2>Access Controls</h2><ul><li>Principle of least privilege</li><li>MFA required for all accounts</li></ul><h2>Incident Reporting</h2><p>All security incidents must be reported within 1 hour of discovery.</p>",
                    "children": [],
                },
                {
                    "title": "Incident Response Runbook",
                    "content": "<h1>Incident Response Runbook</h1><h2>Severity Levels</h2><ul><li><strong>P0</strong> — Data breach or system down</li><li><strong>P1</strong> — Significant degradation</li><li><strong>P2</strong> — Minor issue</li></ul><h2>Response Steps</h2><ol><li>Declare incident and assign incident commander</li><li>Assess scope and severity</li><li>Contain and mitigate</li><li>Communicate to stakeholders</li><li>Post-incident review within 48h</li></ol>",
                    "children": [],
                },
                {
                    "title": "Access Controls Log",
                    "content": "<h1>Access Controls Log</h1><p>Track system access grants and revocations here.</p><h2>Format</h2><p>Date | User | System | Access Level | Approved By | Reason</p>",
                    "children": [],
                },
            ],
            "sprint_defaults": {"duration_weeks": 4},
            "compliance_templates": [
                {"name": "Security Review", "applies_to": "all", "blocks_on": "done", "required_role": "pm"},
                {"name": "Privacy Review",  "applies_to": "all", "blocks_on": "done", "required_role": "pm"},
            ],
        },
    },

    # ── Issue templates ────────────────────────────────────────────────────
    {
        "template_type": "issue",
        "name": "Bug Report",
        "description": "Structured bug report with reproduction steps, expected vs actual, and environment details.",
        "icon": "🐛",
        "category": "engineering",
        "order": 0,
        "config": {
            "title": "Bug: ",
            "description": "<h2>Summary</h2><p>Brief description of the bug.</p><h2>Steps to Reproduce</h2><ol><li>Go to…</li><li>Click…</li><li>See error</li></ol><h2>Expected Behavior</h2><p></p><h2>Actual Behavior</h2><p></p><h2>Environment</h2><p>OS / Browser / Version:</p><h2>Screenshots</h2><p>Attach if applicable.</p>",
            "issue_type": "bug",
            "priority": "high",
            "label_names": ["Bug"],
            "story_points": None,
        },
    },
    {
        "template_type": "issue",
        "name": "Feature Request",
        "description": "Structured feature spec with problem statement, acceptance criteria, and scope boundaries.",
        "icon": "✨",
        "category": "product",
        "order": 1,
        "config": {
            "title": "Feature: ",
            "description": "<h2>Overview</h2><p>Describe the feature.</p><h2>Problem Statement</h2><p>What problem does this solve and for whom?</p><h2>Proposed Solution</h2><p></p><h2>Acceptance Criteria</h2><ul><li>[ ] Criteria 1</li><li>[ ] Criteria 2</li></ul><h2>Out of Scope</h2><p></p>",
            "issue_type": "task",
            "priority": "medium",
            "label_names": ["Feature"],
            "story_points": None,
        },
    },
    {
        "template_type": "issue",
        "name": "Technical Debt",
        "description": "Tech debt ticket with impact assessment, proposed approach, and effort estimate.",
        "icon": "🔧",
        "category": "engineering",
        "order": 2,
        "config": {
            "title": "Tech Debt: ",
            "description": "<h2>What</h2><p>Describe the technical debt.</p><h2>Why It Matters</h2><p>Risk or cost if not addressed.</p><h2>Proposed Approach</h2><p></p><h2>Effort Estimate</h2><p>S / M / L</p>",
            "issue_type": "task",
            "priority": "low",
            "label_names": ["Tech Debt"],
            "story_points": None,
        },
    },
    {
        "template_type": "issue",
        "name": "Incident",
        "description": "Critical incident ticket with timeline, root cause, and follow-up actions.",
        "icon": "🚨",
        "category": "operations",
        "order": 3,
        "config": {
            "title": "Incident: ",
            "description": "<h2>Incident Summary</h2><p>Brief description of what happened.</p><h2>Timeline</h2><ul><li><strong>HH:MM</strong> — Event</li></ul><h2>Impact</h2><p>Users affected / services impacted.</p><h2>Root Cause</h2><p></p><h2>Resolution</h2><p>How it was resolved.</p><h2>Follow-up Actions</h2><ul><li>[ ] Action item</li></ul>",
            "issue_type": "bug",
            "priority": "critical",
            "label_names": [],
            "story_points": None,
        },
    },
    {
        "template_type": "issue",
        "name": "Release Task",
        "description": "Release preparation checklist with scope, pre-release gates, and rollback plan.",
        "icon": "📦",
        "category": "operations",
        "order": 4,
        "config": {
            "title": "Release: v",
            "description": "<h2>Release Version</h2><p>v</p><h2>Scope</h2><p>What is included in this release.</p><h2>Pre-release Checklist</h2><ul><li>[ ] All blocking issues resolved</li><li>[ ] Changelog updated</li><li>[ ] Smoke test passed</li><li>[ ] Stakeholders notified</li></ul><h2>Rollback Plan</h2><p>Describe steps to roll back if needed.</p>",
            "issue_type": "task",
            "priority": "high",
            "label_names": [],
            "story_points": None,
        },
    },

    # ── Wiki templates ─────────────────────────────────────────────────────
    {
        "template_type": "wiki",
        "name": "Architecture Doc",
        "description": "System architecture overview with components, data flow, and key decisions.",
        "icon": "🏗️",
        "category": "engineering",
        "order": 0,
        "config": {
            "title": "Architecture: ",
            "content": "<h1>Architecture Overview</h1><h2>Purpose</h2><p>Describe the overall purpose and goals of this system.</p><h2>System Components</h2><p>List the major components and their responsibilities.</p><h2>Data Flow</h2><p>Describe how data moves through the system.</p><h2>Key Technical Decisions</h2><ul><li>Decision 1: reason</li><li>Decision 2: reason</li></ul><h2>External Dependencies</h2><p>Third-party services, libraries, integrations.</p><h2>Open Questions</h2><ul><li></li></ul>",
        },
    },
    {
        "template_type": "wiki",
        "name": "Runbook",
        "description": "Step-by-step operational runbook with prerequisites, steps, verification, and rollback.",
        "icon": "📋",
        "category": "operations",
        "order": 1,
        "config": {
            "title": "Runbook: ",
            "content": "<h1>Runbook</h1><h2>Purpose</h2><p>What does this runbook cover?</p><h2>Prerequisites</h2><ul><li>Access to …</li><li>Tools: …</li></ul><h2>Steps</h2><ol><li>Step 1</li><li>Step 2</li><li>Step 3</li></ol><h2>Verification</h2><p>How to confirm the process completed successfully.</p><h2>Rollback</h2><p>Steps to reverse the operation.</p><h2>Contacts</h2><p>Who to reach if this fails.</p>",
        },
    },
    {
        "template_type": "wiki",
        "name": "RFC",
        "description": "Request for Comments with motivation, detailed design, drawbacks, and adoption strategy.",
        "icon": "📝",
        "category": "product",
        "order": 2,
        "config": {
            "title": "RFC: ",
            "content": "<h1>RFC: [Title]</h1><h2>Summary</h2><p>One-paragraph summary of the proposal.</p><h2>Motivation</h2><p>Why are we doing this? What problem does it solve?</p><h2>Detailed Design</h2><p>Technical specifics of the proposed change.</p><h2>Drawbacks</h2><p>Known downsides or risks.</p><h2>Alternatives Considered</h2><p>Other approaches explored and why they were not chosen.</p><h2>Adoption Strategy</h2><p>How will this be rolled out?</p>",
        },
    },
    {
        "template_type": "wiki",
        "name": "Postmortem",
        "description": "Incident postmortem with timeline, root cause analysis, impact, and prevention steps.",
        "icon": "🔍",
        "category": "operations",
        "order": 3,
        "config": {
            "title": "Postmortem: ",
            "content": "<h1>Postmortem: [Incident Title]</h1><h2>Incident Summary</h2><p>Brief description of what happened and the impact.</p><h2>Timeline</h2><ul><li><strong>HH:MM</strong> — Event description</li></ul><h2>Root Cause Analysis</h2><p>The underlying cause(s) of the incident.</p><h2>Impact</h2><p>Users affected, services impacted, duration.</p><h2>Resolution</h2><p>How the incident was resolved.</p><h2>Prevention</h2><ul><li>[ ] Action item with owner</li></ul>",
        },
    },
    {
        "template_type": "wiki",
        "name": "Retrospective",
        "description": "Sprint retrospective with wins, improvements, action items, and team kudos.",
        "icon": "🔄",
        "category": "agile",
        "order": 4,
        "config": {
            "title": "Retro: ",
            "content": "<h1>Sprint Retrospective</h1><h2>What Went Well ✓</h2><ul><li></li></ul><h2>What Could Improve ↑</h2><ul><li></li></ul><h2>Action Items</h2><ul><li>[ ] Owner — Action by [date]</li></ul><h2>Team Kudos 🙌</h2><ul><li></li></ul>",
        },
    },
    {
        "template_type": "wiki",
        "name": "Release Note",
        "description": "Release notes with new features, bug fixes, breaking changes, and migration guide.",
        "icon": "🚀",
        "category": "operations",
        "order": 5,
        "config": {
            "title": "Release Note: v",
            "content": "<h1>Release Note: v[X.Y.Z]</h1><h2>Release Date</h2><p>[Date]</p><h2>New Features</h2><ul><li>Feature description</li></ul><h2>Bug Fixes</h2><ul><li>Fixed: issue description</li></ul><h2>Breaking Changes</h2><p>None — or describe changes.</p><h2>Migration Guide</h2><p>Steps required when upgrading.</p>",
        },
    },
]


def seed_system_templates(apps, schema_editor):
    WorkflowTemplate = apps.get_model("templates_app", "WorkflowTemplate")
    for tpl in SYSTEM_TEMPLATES:
        WorkflowTemplate.objects.get_or_create(
            name=tpl["name"],
            template_type=tpl["template_type"],
            project=None,
            defaults={
                "description":   tpl["description"],
                "icon":          tpl["icon"],
                "category":      tpl["category"],
                "order":         tpl["order"],
                "is_active":     True,
                "is_system":     True,
                "config":        tpl["config"],
            },
        )


def remove_system_templates(apps, schema_editor):
    WorkflowTemplate = apps.get_model("templates_app", "WorkflowTemplate")
    WorkflowTemplate.objects.filter(is_system=True).delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("projects", "0004_sprintretro"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkflowTemplate",
            fields=[
                ("id",            models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("template_type", models.CharField(choices=[("project", "Project Setup"), ("issue", "Issue"), ("wiki", "Wiki Page")], max_length=20)),
                ("name",          models.CharField(max_length=200)),
                ("description",   models.TextField(blank=True, default="")),
                ("icon",          models.CharField(blank=True, default="", max_length=10)),
                ("category",      models.CharField(blank=True, default="", max_length=50)),
                ("is_active",     models.BooleanField(default=True)),
                ("is_system",     models.BooleanField(default=False)),
                ("config",        models.JSONField(default=dict)),
                ("order",         models.PositiveSmallIntegerField(default=0)),
                ("created_at",    models.DateTimeField(auto_now_add=True)),
                ("updated_at",    models.DateTimeField(auto_now=True)),
                ("created_by",    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_templates", to=settings.AUTH_USER_MODEL)),
                ("project",       models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="workflow_templates", to="projects.project")),
            ],
            options={"db_table": "workflow_templates", "ordering": ["order", "created_at"]},
        ),
        migrations.RunPython(seed_system_templates, remove_system_templates),
    ]

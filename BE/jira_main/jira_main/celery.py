import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jira_main.settings")

app = Celery("jira_main")

# Pull all CELERY_* keys from Django settings
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in every INSTALLED_APPS/<app>/tasks.py
app.autodiscover_tasks()

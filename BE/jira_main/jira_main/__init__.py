# Make Celery app available at module level so Django's AppRegistry
# picks it up before any app is imported.
from .celery import app as celery_app  # noqa: F401

__all__ = ("celery_app",)

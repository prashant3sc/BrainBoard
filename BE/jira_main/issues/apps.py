from django.apps import AppConfig


class IssuesConfig(AppConfig):
    name = "issues"

    def ready(self):
        # Connect AI embedding signals for Issue and Comment models.
        # Import is deferred to ready() so the full model registry is available.
        from ai_integration.signals import connect_signals
        connect_signals()

from django.apps import AppConfig


class WikiConfig(AppConfig):
    name = "wiki"

    def ready(self):
        # Connect AI embedding signal for WikiPage model.
        # dispatch_uid in connect_signals() prevents double-registration
        # if both IssuesConfig and WikiConfig call it.
        from ai_integration.signals import connect_signals
        connect_signals()

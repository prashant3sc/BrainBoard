import logging
import sys
import json
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Formats log records as structured JSON for production log aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)


def setup_logging(debug: bool = False) -> None:
    """Configure structured JSON logging for the application.
    Logs are written to:
      1. Console (stdout) — visible in Docker logs / terminal
      2. logs/app.log    — persisted log file on disk
    """
    import os
    level = logging.DEBUG if debug else logging.INFO

    # --- Console Handler ---
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JSONFormatter())

    # --- File Handler ---
    file_handler = logging.FileHandler("logs.txt", encoding="utf-8")
    file_handler.setFormatter(JSONFormatter())

    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = [console_handler, file_handler]

    # Suppress noisy third-party logs
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("langchain").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Returns a named logger for a module."""
    return logging.getLogger(name)

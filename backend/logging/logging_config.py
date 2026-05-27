# -----------------------------------------------------------------------------
# Copyright (c) 2025-2026 DKTech Innovations.
# Licensed under the CC-BY-NC-4.0 License. See LICENSE file in the project root.
#
# Project: ForestWatch Togo - Land Cover & Deforestation AI Monitor
# Maintainer: Kodjo Jean DEGBEVI (@kjd-dktech)
# -----------------------------------------------------------------------------

import json, logging, contextvars
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
from pathlib import Path

# Propagation globale du request_id au sein d'une requête async
request_id_var = contextvars.ContextVar("request_id", default="-")

CURRENT_DIR = Path(__file__).resolve().parent
LOG_DIR = CURRENT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

class RequestContextLogFilter(logging.Filter):
    """Injecte le request_id en cours dans les logs."""
    def filter(self, record):
        record.request_id = request_id_var.get()
        return True

class JsonFormatter(logging.Formatter):
    """Formateur JSON pour les fichiers de logs."""
    def __init__(self, service=None):
        super().__init__()
        self.service = service

    def format(self, record):
        log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": self.service,
            "message": record.getMessage(),
            "file": record.filename,
            "line": record.lineno,
        }

        if hasattr(record, "request_id") and record.request_id != "-":
            log["request_id"] = record.request_id

        return json.dumps(log, ensure_ascii=False)

def setup_logger(module_name: str, service_name: str, log_filename: str) -> logging.Logger:
    """
    Logging centralisée.
    :param module_name: Le dossier (ex: "api", "core")
    :param service_name: Le module / fichier (ex: "main", "predictor")
    :param log_filename: Le fichier physique de destination (ex: "api.log", "predict.log")
    """
    logger_name = f"{module_name}.{service_name}"
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)

    # Si le logger est déjà initialisé, on évite d'ajouter les handlers en double
    if not logger.handlers:
        req_filter = RequestContextLogFilter()

        # Handler Console
        ch = logging.StreamHandler()
        classic_formatter = logging.Formatter(
            f"[%(asctime)s] [%(levelname)s] [{logger_name}] [ReqID:%(request_id)s] %(message)s", 
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        ch.setFormatter(classic_formatter)
        ch.addFilter(req_filter)
        logger.addHandler(ch)

        # Handler Fichier
        fh = RotatingFileHandler(
            LOG_DIR / log_filename,
            maxBytes=5*1024*1024,
            backupCount=5,
            encoding="utf-8"
        )
        fh.setFormatter(JsonFormatter(service_name))
        fh.addFilter(req_filter)
        logger.addHandler(fh)

        logger.propagate = False

    return logger

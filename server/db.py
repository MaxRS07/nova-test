import json
import logging
from supabase import create_client
import os

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def persist_event(run_id: str, event_type: str, data) -> None:
    """Insert a single streaming event into test_run_events. data column is text (JSON string)."""
    try:
        supabase.table("test_run_events").insert({
            "run_id": run_id,
            "type": event_type,
            "data": json.dumps(data),
        }).execute()
    except Exception as e:
        logger.error(f"Failed to persist event '{event_type}' for run {run_id}: {e}")


def update_run_status(run_id: str, status: str) -> None:
    try:
        supabase.table("test_runs").update({"status": status}).eq("id", run_id).execute()
    except Exception as e:
        logger.error(f"Failed to update status for run {run_id}: {e}")

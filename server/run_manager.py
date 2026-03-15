# run_manager.py
# Manages run lifecycle and task tracking. No WebSocket — all streaming goes to Supabase.

import asyncio
import uuid
from typing import Dict
from nova.types import Agent


class RunManager:
    def __init__(self):
        self.tasks: Dict[str, asyncio.Task] = {}
        self.run_configs: Dict[str, dict] = {}

    # ── Run lifecycle ──────────────────────────────────────────────────────────

    def create_run(self) -> str:
        run_id = str(uuid.uuid4())
        return run_id

    def store_run_config(self, run_id: str, config: dict):
        self.run_configs[run_id] = config

    def get_run_config(self, run_id: str) -> dict:
        return self.run_configs.get(run_id, {})

    def register_task(self, run_id: str, task: asyncio.Task):
        self.tasks[run_id] = task

    def cancel_task(self, run_id: str):
        task = self.tasks.pop(run_id, None)
        if task and not task.done():
            task.cancel()

    def is_running(self, run_id: str) -> bool:
        task = self.tasks.get(run_id)
        return task is not None and not task.done()

    def cleanup(self, run_id: str):
        self.tasks.pop(run_id, None)
        self.run_configs.pop(run_id, None)


run_manager = RunManager()


# ── Run execution ──────────────────────────────────────────────────────────────

async def execute_act_run(run_id: str, config: dict):
    from nova.act_runner import ActRunner
    from nova.process_manager import process_manager
    from db import persist_event, update_run_status

    agent_config = list(map(lambda x: Agent(**x), config.get("agent_config", [])))
    url = config.get("url", "")
    pages = config.get("pages", [])

    try:
        update_run_status(run_id, "running")
        runner = ActRunner(run_id=run_id)

        async for metadata in runner.run_act(url, pages, agent_config):
            metadata_dict = {
                "prompt": metadata.prompt,
                "num_steps": metadata.num_steps_executed,
            }
            if hasattr(metadata, "action_type"):
                metadata_dict["action_type"] = metadata.action_type
            if hasattr(metadata, "action"):
                metadata_dict["action"] = metadata.action

            persist_event(run_id, "metadata", metadata_dict)

        update_run_status(run_id, "completed")
        process_manager.mark_done(run_id, "completed")

    except asyncio.CancelledError:
        update_run_status(run_id, "cancelled")
        process_manager.mark_done(run_id, "cancelled")

    except Exception as e:
        update_run_status(run_id, "failed")
        process_manager.mark_done(run_id, "failed")

    finally:
        run_manager.cleanup(run_id)

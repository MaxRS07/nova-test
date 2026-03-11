import asyncio
from typing import Dict, Optional, Any

class ProcessManager:
    def __init__(self):
        self.processes: Dict[str, dict] = {}

    def register(self, run_id: str, task: asyncio.Task, metadata: dict = {}):
        self.processes[run_id] = {
            "task": task,
            "status": "running",
            "metadata": metadata,
        }

    def stop(self, run_id: str):
        entry = self.processes.get(run_id)
        if entry:
            task = entry["task"]
            if not task.done():
                task.cancel()
            entry["status"] = "cancelled"

    def get(self, run_id: str) -> Optional[dict]:
        return self.processes.get(run_id)

    def is_running(self, run_id: str) -> bool:
        entry = self.processes.get(run_id)
        if not entry:
            return False
        return not entry["task"].done()

    def mark_done(self, run_id: str, status: str = "completed"):
        entry = self.processes.get(run_id)
        if entry:
            entry["status"] = status

    def list_all(self) -> Dict[str, str]:
        return {
            rid: entry["status"]
            for rid, entry in self.processes.items()
        }


process_manager = ProcessManager()
"""
Drains the thinking line queue in a background thread and persists
each line to Supabase as a 'thinking' event.
"""

import logging
import queue
import threading
import asyncio

logger = logging.getLogger(__name__)


class ThinkingStreamer:
    def __init__(self, run_id: str, line_queue: queue.Queue, loop: asyncio.AbstractEventLoop):
        self.run_id = run_id
        self.line_queue = line_queue
        self.loop = loop
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._drain, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop_event.set()

    def join(self, timeout: float = 5.0):
        self._thread.join(timeout=timeout)

    def _drain(self):
        from db import persist_event

        while not self._stop_event.is_set() or not self.line_queue.empty():
            try:
                line = self.line_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            try:
                persist_event(self.run_id, "thinking", line)
            except Exception as e:
                logger.error(f"Failed to persist thinking event for run {self.run_id}: {e}")

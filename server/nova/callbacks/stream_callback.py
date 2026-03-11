import asyncio
import uuid
import logging
from fastapi import WebSocket
from nova_act import NovaAct, Workflow, ActMetadata
from nova_act.tools.human.interface.human_input_callback import (
    ApprovalResponse, HumanInputCallbacksBase, UiTakeoverResponse,
)
from websocket_manager import run_manager

logger = logging.getLogger(__name__)


class StreamInputCallback(HumanInputCallbacksBase):
    def __init__(self, run_id: str):
        self.run_id = run_id
        self._act_session_id = None  # To track the current Act session if needed

    def approve(self, message) -> ApprovalResponse:
        """Send approval request over the run's WebSocket and block until response."""
        try:
            loop = asyncio.get_event_loop()
            future = asyncio.run_coroutine_threadsafe(
                run_manager.request(self.run_id, {"message": message}),
                loop
            )
            response = future.result(timeout=300)

            approved = response.get("approved", False) if isinstance(response, dict) else False
            reason = response.get("reason", "") if isinstance(response, dict) else ""

            logger.debug(f"Approval response for run {self.run_id}: approved={approved}")
            return ApprovalResponse(approved=approved, reason=reason)

        except TimeoutError:
            error_msg = "Approval request timed out after 300 seconds"
            logger.warning(f"Run {self.run_id}: {error_msg}")
            return ApprovalResponse(approved=False, reason=error_msg)
        except asyncio.CancelledError:
            error_msg = "Approval request cancelled"
            logger.warning(f"Run {self.run_id}: {error_msg}")
            return ApprovalResponse(approved=False, reason=error_msg)
        except Exception as e:
            error_msg = f"Error waiting for approval: {str(e)}"
            logger.error(f"Run {self.run_id}: {error_msg}")
            return ApprovalResponse(approved=False, reason=error_msg)

    def ui_takeover(self, message) -> UiTakeoverResponse:
        return super().ui_takeover(message)
    
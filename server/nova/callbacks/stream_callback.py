import logging
from nova_act.tools.human.interface.human_input_callback import (
    ApprovalResponse, HumanInputCallbacksBase, UiTakeoverResponse,
)

logger = logging.getLogger(__name__)


class StreamInputCallback(HumanInputCallbacksBase):
    """Auto-approves all requests since there is no client WebSocket to consult."""

    def __init__(self, run_id: str, *args, **kwargs):
        self.run_id = run_id

    def approve(self, message) -> ApprovalResponse:
        logger.info(f"Run {self.run_id}: auto-approving request: {message}")
        return ApprovalResponse(approved=True, reason="Auto-approved")

    def ui_takeover(self, message) -> UiTakeoverResponse:
        return super().ui_takeover(message)

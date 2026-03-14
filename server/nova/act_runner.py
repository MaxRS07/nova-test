import asyncio
import contextlib
import logging
import os
import queue
import threading
import time
import traceback
from typing import AsyncGenerator, Optional

from nova_act import ActMetadata

from nova.agent_factory import create_agent
from nova.log_handler import WsLogHandler, WsStdoutCapture
from nova.schemas.fault import Faults
from nova.types import Agent

logger = logging.getLogger(__name__)

KEY = os.getenv("NOVA_ACT_API_KEY")

if not KEY:
    raise ValueError("NOVA_ACT_API_KEY environment variable is not set")


class ActRunner:
    """Manages Nova Act agent execution with optional WebSocket integration."""

    def __init__(self, run_id: Optional[str] = None):
        self.run_id = run_id
        self.nova = None

    async def run_act(
        self,
        url: str,
        pages: list[str],
        agent_config: list[Agent],
    ) -> AsyncGenerator[ActMetadata, None]:
        """
        Run Nova Act workflow with optional WebSocket-based approval handling.

        Yields:
            ActMetadata for each step executed
        """
        results_queue: queue.Queue = queue.Queue()
        loop = asyncio.get_running_loop()

        # Human approval callback
        if self.run_id:
            from nova.callbacks.stream_callback import StreamInputCallback
            human_callback = StreamInputCallback(self.run_id, loop)
        else:
            human_callback = None

        ws_handler = WsLogHandler(self.run_id, loop) if self.run_id else None
        ws_stdout = WsStdoutCapture(self.run_id, loop) if self.run_id else None
        error_occurred = False

        def _send(payload: dict):
            """Fire-and-forget send from sync thread to the async event loop."""
            from websocket_manager import run_manager
            asyncio.run_coroutine_threadsafe(run_manager.send(self.run_id, payload), loop)

        def run_sync():
            nonlocal error_occurred

            if ws_handler:
                ws_handler.attach("nova_act")

            # Ensure this thread has no event loop (safety for Python 3.10+)
            try:
                asyncio.set_event_loop(None)
            except Exception:
                pass

            # Capture NovaAct stdout prints and forward them over the socket
            stdout_ctx = ws_stdout if ws_stdout else contextlib.nullcontext()

            with stdout_ctx:
                try:
                    use_agent = agent_config[0]
                    use_agent_config = use_agent.get("config", {})

                    temp = use_agent_config.get("temperature", 0.7)
                    model_top_P = use_agent_config.get("topP", 5)

                    agent = create_agent(url, human_callback, use_agent)
                    self.nova = agent

                    try:
                        with agent:
                            for step in use_agent.get("actions", []):
                                step_start = time.time()
                                try:
                                    res = agent.act_get(
                                        step,
                                        max_steps=10,
                                        timeout=200,
                                        model_seed=1,
                                        model_top_k=model_top_P,
                                        model_temperature=temp,
                                        schema=Faults.model_json_schema(),
                                    )
                                    results_queue.put(res.metadata)

                                    if res.matches_schema:
                                        _send({"type": "fault", "fault": res.parsed_response})

                                    if not agent.page.url.startswith(url):
                                        agent.go_to_url(url)
                                        if errors := agent.page.page_errors():
                                            _send({
                                                "type": "page_error",
                                                "page": agent.page.url,
                                                "errors": errors,
                                            })

                                except Exception as step_error:
                                    error_occurred = True
                                    error_msg = f"Error executing step '{step}': {str(step_error)}"
                                    logger.error(error_msg)
                                    logger.debug(traceback.format_exc())
                                    results_queue.put(Exception(error_msg))
                                    break
                                finally:
                                    step_end = time.time()
                                    logger.info(f"Step '{step}' completed in {step_end - step_start:.2f} seconds")

                    except Exception as agent_error:
                        error_occurred = True
                        error_msg = f"Error during agent execution: {str(agent_error)}"
                        logger.error(error_msg)
                        logger.debug(traceback.format_exc())
                        results_queue.put(Exception(error_msg))

                except Exception as init_error:
                    error_occurred = True
                    error_msg = f"Error initializing Nova Act agent: {str(init_error)}"
                    logger.error(error_msg)
                    logger.debug(traceback.format_exc())
                    results_queue.put(Exception(error_msg))

                finally:
                    if ws_handler:
                        ws_handler.detach()

                    if self.nova:
                        try:
                            if hasattr(self.nova, "close"):
                                self.nova.close()
                        except Exception as cleanup_error:
                            logger.warning(f"Error closing Nova agent: {str(cleanup_error)}")

                    self.nova = None
                    results_queue.put(None)  # sentinel

        thread = threading.Thread(target=run_sync, daemon=True)
        thread.start()

        try:
            while True:
                item = await loop.run_in_executor(None, results_queue.get)

                if item is None:
                    break
                if isinstance(item, Exception):
                    if self.run_id:
                        try:
                            from websocket_manager import run_manager
                            await run_manager.emit(self.run_id, "error", {"error": str(item)})
                        except Exception as ws_error:
                            logger.warning(f"Failed to send error to websocket: {str(ws_error)}")
                    raise item
                yield item

        except Exception as exec_error:
            error_msg = f"Error during act execution: {str(exec_error)}"
            logger.error(error_msg)
            logger.debug(traceback.format_exc())

            if self.run_id:
                try:
                    from websocket_manager import run_manager
                    await run_manager.emit(self.run_id, "error", {"error": error_msg})
                except Exception as ws_error:
                    logger.warning(f"Failed to send error to websocket: {str(ws_error)}")
            raise

        finally:
            try:
                await asyncio.wait_for(loop.run_in_executor(None, thread.join), timeout=10)
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for thread to finish")
            except Exception as join_error:
                logger.warning(f"Error waiting for thread to finish: {str(join_error)}")

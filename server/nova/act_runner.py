import asyncio
import logging
import os
import queue
import threading
import time
import traceback
from typing import AsyncGenerator, Optional

from nova_act import ActMetadata

from nova.agent_factory import create_agent
from nova.schemas.fault import Faults
from nova.thinking_log_handler import ThinkingLogHandler
from nova.thinking_streamer import ThinkingStreamer
from nova.types import Agent

logger = logging.getLogger(__name__)

KEY = os.getenv("NOVA_ACT_API_KEY")

if not KEY:
    raise ValueError("NOVA_ACT_API_KEY environment variable is not set")


class ActRunner:
    """Manages Nova Act agent execution, streaming events to Supabase."""

    def __init__(self, run_id: Optional[str] = None):
        self.run_id = run_id
        self.nova = None

    async def run_act(
        self,
        url: str,
        pages: list[str],
        agent_config: list[Agent],
    ) -> AsyncGenerator[ActMetadata, None]:
        from db import persist_event

        results_queue: queue.Queue = queue.Queue()
        loop = asyncio.get_running_loop()

        # Thinking log capture
        thinking_queue: queue.Queue = queue.Queue()
        thinking_handler = ThinkingLogHandler(thinking_queue)
        thinking_streamer: Optional[ThinkingStreamer] = None

        if self.run_id:
            trace_logger = logging.getLogger(ThinkingLogHandler.LOGGER_NAME)
            trace_logger.addHandler(thinking_handler)
            thinking_streamer = ThinkingStreamer(self.run_id, thinking_queue, loop)
            thinking_streamer.start()

        def run_sync():
            use_agent = agent_config[0]
            use_agent_config = use_agent.get("config", {})
            temp = use_agent_config.get("temperature", 0.7)
            model_top_P = use_agent_config.get("topP", 5)

            agent = create_agent(url, None, use_agent)
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

                            if res.matches_schema and self.run_id:
                                persist_event(self.run_id, "fault", res.parsed_response)

                            if not agent.page.url.startswith(url):
                                agent.go_to_url(url)
                                if errors := agent.page.page_errors():
                                    if self.run_id:
                                        persist_event(self.run_id, "page_error", {
                                            "page": agent.page.url,
                                            "errors": errors,
                                        })

                        except Exception as step_error:
                            error_msg = f"Error executing step '{step}': {str(step_error)}"
                            logger.error(error_msg)
                            logger.debug(traceback.format_exc())
                            results_queue.put(Exception(error_msg))
                            break
                        finally:
                            step_end = time.time()
                            logger.info(f"Step '{step}' completed in {step_end - step_start:.2f} seconds")

            except Exception as agent_error:
                error_msg = f"Error during agent execution: {str(agent_error)}"
                logger.error(error_msg)
                logger.debug(traceback.format_exc())
                results_queue.put(Exception(error_msg))

            finally:
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
                    raise item
                yield item

        except Exception as exec_error:
            logger.error(f"Error during act execution: {str(exec_error)}")
            logger.debug(traceback.format_exc())
            raise

        finally:
            if thinking_streamer:
                thinking_streamer.stop()
                thinking_streamer.join(timeout=5.0)

            if self.run_id:
                trace_logger = logging.getLogger(ThinkingLogHandler.LOGGER_NAME)
                trace_logger.removeHandler(thinking_handler)

            try:
                await asyncio.wait_for(loop.run_in_executor(None, thread.join), timeout=10)
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for thread to finish")
            except Exception as join_error:
                logger.warning(f"Error waiting for thread to finish: {str(join_error)}")

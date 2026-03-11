from nova_act import NovaAct, Workflow, ActMetadata
from nova_act.tools.human.interface.human_input_callback import (
    ApprovalResponse, HumanInputCallbacksBase, UiTakeoverResponse,
)
from dotenv import load_dotenv
from typing import AsyncGenerator, Optional
import os
import logging
import traceback
from nova.types import Agent
import time

# Configure logging
logger = logging.getLogger(__name__)

KEY = os.getenv("NOVA_ACT_API_KEY")

if not KEY:
    raise ValueError("NOVA_ACT_API_KEY environment variable is not set")


class ActRunner:
    """Manages Nova Act agent execution with optional WebSocket integration."""
    
    def __init__(self, run_id: Optional[str] = None):
        """
        Initialize ActRunner.
        
        Args:
            run_id: Optional run ID for WebSocket-based approval integration
        """
        self.run_id = run_id
        self.nova = None
    
    @staticmethod
    def create_agent(
        url: str,
        human_callback: Optional[HumanInputCallbacksBase] = None,
        agent_config: Optional[Agent] = None
    ) -> NovaAct:
        """
        Create a Nova Act agent with optional human callback for approvals.
        
        Args:
            url: Starting page URL
            context: Agent context/instructions
            human_callback: Optional callback for human approval handling
            
        Returns:
            NovaAct: Initialized Nova Act agent
            
        Raises:
            ValueError: If API key is missing
            Exception: If agent creation fails
        """
        try:
            if not KEY:
                raise ValueError("NOVA_ACT_API_KEY environment variable is not set")
            
            logger.info(f"Creating Nova Act agent for URL: {url}")
            act = NovaAct(
                nova_act_api_key=KEY,
                starting_page=url,
                human_input_callbacks=human_callback,
            )
            logger.info("Nova Act agent created successfully")
            return act
        except ValueError as ve:
            logger.error(f"Configuration error: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Error creating Nova Act agent: {str(e)}")
            logger.debug(traceback.format_exc())
            raise Exception(f"Failed to create Nova Act agent: {str(e)}")
    
    async def run_act(
        self,
        url: str,
        pages: list[str],
        agent_config: list[Agent]
    ) -> AsyncGenerator[ActMetadata]:
        """
        Run Nova Act workflow with optional WebSocket-based approval handling.
        
        Args:
            url: Starting URL for the browser
            context: Agent context/instructions
            *steps: Variable number of steps/actions to execute
            
        Yields:
            ActMetadata for each step executed
            
        Raises:
            Exception: If the act fails or times out, with detailed error message
        """
        import asyncio
        import queue
        import threading
        import traceback

        # Import here to avoid circular imports
        if self.run_id:
            from nova.callbacks.stream_callback import StreamInputCallback
            human_callback = StreamInputCallback(self.run_id)
        else:
            human_callback = None

        results_queue: queue.Queue = queue.Queue()
        loop = asyncio.get_running_loop()
        error_occurred = False

        def run_sync():
            """Run NovaAct in a thread with no event loop so Playwright sync API works."""
            nonlocal error_occurred
            
            # Ensure this thread has no event loop (safety for Python 3.10+)
            try:
                asyncio.set_event_loop(None)
            except Exception:
                pass
            
            subpages = []
            _agent_config = agent_config[0]
            try:
                agent = self.create_agent(url, human_callback, _agent_config)
                self.nova = agent
                
                try:
                    with agent:
                        for step in _agent_config.get("actions", []):
                            step_start = time.time()
                            try:
                                res = agent.act(step)
                                results_queue.put(res.metadata)
                                
                                if not agent.page.url.startswith(url):
                                    agent.go_to_url(url)
                                    if errors := agent.page.page_errors():
                                        run_manager.send(self.run_id, {
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
                # Always cleanup the agent properly
                if self.nova:
                    try:
                        if hasattr(self.nova, 'close'):
                            self.nova.close()
                    except Exception as cleanup_error:
                        logger.warning(f"Error closing Nova agent: {str(cleanup_error)}")
                
                self.nova = None
                results_queue.put(None)  # sentinel

        # Spin up a real thread (not executor) so we control the event loop context
        thread = threading.Thread(target=run_sync, daemon=True)
        thread.start()

        try:
            while True:
                # Unblock get() in executor so we don't block the event loop
                item = await loop.run_in_executor(None, results_queue.get)

                if item is None:  # sentinel — done
                    break
                if isinstance(item, Exception):
                    # Close websocket via run_manager if available
                    if self.run_id:
                        try:
                            from websocket_manager import run_manager
                            await run_manager.emit(
                                self.run_id, 
                                "error", 
                                {"error": str(item)}
                            )
                        except Exception as ws_error:
                            logger.warning(f"Failed to send error to websocket: {str(ws_error)}")
                    raise item
                yield item
        except Exception as exec_error:
            # Log the error and ensure websocket is notified
            error_msg = f"Error during act execution: {str(exec_error)}"
            logger.error(error_msg)
            logger.debug(traceback.format_exc())
            
            if self.run_id:
                try:
                    from websocket_manager import run_manager
                    await run_manager.emit(
                        self.run_id, 
                        "error", 
                        {"error": error_msg}
                    )
                except Exception as ws_error:
                    logger.warning(f"Failed to send error to websocket: {str(ws_error)}")
            
            raise
        finally:
            # Wait for thread to finish cleanly
            try:
                await asyncio.wait_for(loop.run_in_executor(None, thread.join), timeout=10)
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for thread to finish")
            except Exception as join_error:
                logger.warning(f"Error waiting for thread to finish: {str(join_error)}")
            

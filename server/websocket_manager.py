# websocket_manager.py

from fastapi import WebSocket, WebSocketDisconnect, APIRouter
import asyncio
import uuid
from typing import Dict, Any
from nova.types import Agent

router = APIRouter()


class RunManager:
    """Manages per-run WebSocket connections and message routing."""

    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}       # run_id -> WebSocket
        self.pending_requests: Dict[str, asyncio.Future] = {}  # request_id -> Future
        self.tasks: Dict[str, asyncio.Task] = {}          # run_id -> background Task
        self.run_configs: Dict[str, dict] = {}            # run_id -> config (url, context, steps)
        self.start_events: Dict[str, asyncio.Event] = {}  # run_id -> Event to signal start

    # -----------------------------
    # Connection handling
    # -----------------------------

    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections[run_id] = websocket

    def disconnect(self, run_id: str):
        self.connections.pop(run_id, None)
        self.run_configs.pop(run_id, None)
        self.start_events.pop(run_id, None)

        # Cancel pending requests for this run
        for req_id, future in list(self.pending_requests.items()):
            if req_id.startswith(run_id) and not future.done():
                future.set_exception(Exception("Client disconnected"))
                self.pending_requests.pop(req_id, None)

    # -----------------------------
    # Process / task management
    # -----------------------------

    def create_run(self) -> str:
        """Create a new run ID."""
        run_id = str(uuid.uuid4())
        self.start_events[run_id] = asyncio.Event()
        return run_id
    
    def store_run_config(self, run_id: str, config: dict):
        """Store configuration for a run (url, context, steps)."""
        self.run_configs[run_id] = config
    
    def get_run_config(self, run_id: str) -> dict:
        """Get configuration for a run."""
        return self.run_configs.get(run_id, {})
    
    async def wait_for_start(self, run_id: str, timeout: int = 300):
        """Wait for the start command to be sent via WebSocket."""
        event = self.start_events.get(run_id)
        if event:
            try:
                await asyncio.wait_for(event.wait(), timeout)
            except asyncio.TimeoutError:
                raise Exception(f"Start command timeout for run {run_id}")
    
    def signal_start(self, run_id: str):
        """Signal that the start command was received."""
        event = self.start_events.get(run_id)
        if event:
            event.set()

    def register_task(self, run_id: str, task: asyncio.Task):
        self.tasks[run_id] = task

    def cancel_task(self, run_id: str):
        task = self.tasks.pop(run_id, None)
        if task and not task.done():
            task.cancel()

    def is_running(self, run_id: str) -> bool:
        task = self.tasks.get(run_id)
        return task is not None and not task.done()

    # -----------------------------
    # Sending messages
    # -----------------------------

    async def send(self, run_id: str, message: dict):
        ws = self.connections.get(run_id)
        if ws:
            await ws.send_json(message)

    async def emit(self, run_id: str, event: str, data: Any = None):
        """Send a typed event to the client."""
        await self.send(run_id, {"type": event, "data": data})

    # -----------------------------
    # Request → Wait → Response
    # -----------------------------

    async def request(
        self,
        run_id: str,
        payload: dict,
        timeout: int = 300,
    ) -> Any:
        request_id = f"{run_id}:{uuid.uuid4()}"
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.pending_requests[request_id] = future

        await self.send(
            run_id,
            {
                "type": "request",
                "request_id": request_id,
                "payload": payload,
            },
        )

        try:
            result = await asyncio.wait_for(future, timeout)
            return result
        finally:
            self.pending_requests.pop(request_id, None)

    # -----------------------------
    # Incoming messages
    # -----------------------------

    async def handle_message(self, run_id: str, data: dict):
        msg_type = data.get("type")

        if msg_type == "response":
            request_id = data.get("request_id")
            future = self.pending_requests.get(request_id)
            if future and not future.done():
                future.set_result(data.get("payload"))

        elif msg_type == "start":
            # Signal that the start command was received
            self.signal_start(run_id)
            await self.emit(run_id, "status", {"status": "starting"})

        elif msg_type == "cancel":
            self.cancel_task(run_id)
            await self.emit(run_id, "cancelled")


run_manager = RunManager()


# ---------------------------------
# WebSocket endpoint  ws/run/{run_id}
# ---------------------------------

async def execute_act_run(run_id: str, config: dict):
    """Execute the act run with the stored configuration."""
    from nova.act_runner import ActRunner
    from nova.process_manager import process_manager
    
    url = config.get("url", "")
    context = config.get("context", "")
    steps = config.get("steps", [])
    agent_config = list(map(lambda x: Agent(**x), config.get("agent_config", [])))
    pages = config.get("pages", [])
    print(agent_config)
    try:
        await run_manager.emit(run_id, "status", {"status": "started"})
        runner = ActRunner(run_id=run_id)
        async for metadata in runner.run_act(url, pages, agent_config):
            # Convert metadata to a JSON-serializable dictionary
            metadata_dict = {
                "prompt": metadata.prompt,
                "num_steps": metadata.num_steps_executed,
            }
            # Add other available metadata fields if they exist
            if hasattr(metadata, "action_type"):
                metadata_dict["action_type"] = metadata.action_type
            if hasattr(metadata, "action"):
                metadata_dict["action"] = metadata.action
            if hasattr(metadata, "screenshot"):
                metadata_dict["screenshot"] = metadata.screenshot
            
            await run_manager.emit(run_id, "metadata", metadata_dict)
        await run_manager.emit(run_id, "status", {"status": "completed"})
        process_manager.mark_done(run_id, "completed")
    except asyncio.CancelledError:
        await run_manager.emit(run_id, "status", {"status": "cancelled"})
        process_manager.mark_done(run_id, "cancelled")
    except Exception as e:
        await run_manager.emit(run_id, "status", {"status": "error", "error": str(e)})
        process_manager.mark_done(run_id, "error")

@router.websocket("/ws/run/{run_id}")
async def websocket_run_endpoint(websocket: WebSocket, run_id: str):
    """
    Per-run WebSocket. The frontend connects here after calling /start-act
    and waits for a "start" message to begin execution.
    
    Expected client messages:
    - {"type": "start"} - Start the act execution
    - {"type": "response", "request_id": "...", "payload": {...}} - Response to approval request
    - {"type": "cancel"} - Cancel the current run
    """
    await run_manager.connect(run_id, websocket)

    try:
        # Start a background task that waits for the start signal and executes the act
        config = run_manager.get_run_config(run_id)
        
        async def _wait_and_run():
            try:
                await run_manager.wait_for_start(run_id, timeout=300)
                # Once start is signaled, execute the act
                await execute_act_run(run_id, config)
            except Exception as e:
                await run_manager.emit(run_id, "status", {"status": "error", "error": str(e)})
                from nova.process_manager import process_manager
                process_manager.mark_done(run_id, "error")
            finally:
                # Close the WebSocket once the run is done so the client detects completion
                try:
                    await websocket.close()
                except Exception:
                    pass
        
        task = asyncio.create_task(_wait_and_run())
        from nova.process_manager import process_manager
        process_manager.register(run_id, task, config)
        run_manager.register_task(run_id, task)
        
        # Listen for incoming messages from the client
        while True:
            data = await websocket.receive_json()
            await run_manager.handle_message(run_id, data)

    except WebSocketDisconnect:
        run_manager.disconnect(run_id)
    except Exception:
        run_manager.disconnect(run_id)

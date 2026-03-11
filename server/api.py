from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from websocket_manager import router as ws_router, run_manager
from nova.process_manager import process_manager
from nova.types import Agent


# Lifespan context manager for startup/shutdown
@asynccontextmanager  
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Nova Flow API starting up...")
    print("📚 Routes available at /docs")
    yield
    # Shutdown
    print("🛑 Nova Flow API shutting down...")

app = FastAPI(
    title="Nova Flow API",
    description="Browser automation API powered by Amazon Nova Act",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include route modules
app.include_router(ws_router)

@app.get("/", response_model=dict)
async def root():
    """API root endpoint with information"""
    return {
        "name": "Nova Flow API",
        "description": "Browser automation powered by Amazon Nova Act",
        "docs": "/docs",
        "websocket": "ws://localhost:8000/ws/{client_id}",
        "endpoints": {
            "websocket": "ws://{host}:{port}/ws/{client_id} - Bidirectional streaming for approvals and task updates"
        }
    }

@app.post("/start-act", response_model=dict)
async def start_act(data: dict):
    """
    Start a new Nova Act run.
    Returns a run_id — connect to ws/run/{run_id}, send {"type": "start"} to begin execution.
    """
    url = data.get("url", "")
    pages = data.get("pages", [])
    agent_config = map(lambda x: Agent(**x), data.get("agent_config", []))

    run_id = run_manager.create_run()
    
    # Store the configuration for later use when "start" command is received
    run_manager.store_run_config(run_id, {"url": url, "pages": pages, "agent_config": list(agent_config)})

    return {"run_id": run_id}


def start_server():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

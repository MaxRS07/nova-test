from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from run_manager import run_manager, execute_act_run
from nova.process_manager import process_manager
from nova.types import Agent
import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Nova Flow API starting up...")
    print("📚 Routes available at /docs")
    yield
    print("🛑 Nova Flow API shutting down...")


app = FastAPI(
    title="Nova Flow API",
    description="Browser automation API powered by Amazon Nova Act",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=dict)
async def root():
    return {
        "name": "Nova Flow API",
        "description": "Browser automation powered by Amazon Nova Act",
        "docs": "/docs",
    }


@app.post("/start-act", response_model=dict)
async def start_act(data: dict):
    """
    Start a new Nova Act run. Executes immediately in the background.
    Streams all events to Supabase — subscribe via Realtime on the frontend.
    """
    url = data.get("url", "")
    pages = data.get("pages", [])
    agent_config = list(map(lambda x: Agent(**x), data.get("agent_config", [])))

    run_id = run_manager.create_run()
    config = {"url": url, "pages": pages, "agent_config": agent_config}
    run_manager.store_run_config(run_id, config)

    task = asyncio.create_task(execute_act_run(run_id, config))
    process_manager.register(run_id, task, config)
    run_manager.register_task(run_id, task)

    return {"run_id": run_id}


def start_server():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

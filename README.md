# NovaTest

AI-powered browser testing platform built on [Amazon Nova Act](https://nova.amazon.com/act).

## What it does

NovaTest runs autonomous browser agents against your web app to detect UI faults, visual errors, and broken flows — without writing test scripts.

## Stack

- **Frontend** — Next.js, Supabase Realtime
- **Backend** — FastAPI (Python)
- **Agent** — Amazon Nova Act
- **Database** — Supabase (Postgres)

## Getting started

**Frontend**
```bash
cd nova-flow
npm install
npm run dev
```

**Backend**
```bash
cd server
pip install -r requirements.txt
python main.py
```

**Environment variables**

```env
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_KEY=
NOVA_ACT_API_URL=http://localhost:8000

# Backend (.env)
SUPABASE_URL=
SUPABASE_KEY=
NOVA_ACT_API_KEY=
```

## How it works

1. Point NovaTest at a URL and configure your agents
2. The backend spins up Nova Act browser agents and streams events to Supabase
3. The frontend subscribes via Supabase Realtime — live logs, thinking traces, and faults appear as they happen
4. Results persist across reloads and are accessible from any device

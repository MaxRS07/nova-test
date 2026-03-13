import type { TestRun, Agent, Project } from '@/types/nova';

const BASE = '/api/sb';

// ── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000; // 30 s

function cacheGet<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL) { cache.delete(key); return null; }
    return entry.data as T;
}

function cacheSet(key: string, data: unknown) {
    cache.set(key, { data, ts: Date.now() });
}

function cacheInvalidate(prefix: string) {
    for (const key of cache.keys()) {
        if (key.includes(prefix)) cache.delete(key);
    }
}

async function fetchCached<T>(url: string): Promise<T> {
    const cached = cacheGet<T>(url);
    // Return cache immediately; refresh in background
    if (cached !== null) {
        fetch(url).then(r => r.ok && r.json().then(d => cacheSet(url, d)) || null).catch(() => { });
        return cached;
    }
    const res = await fetch(url);
    if (!res.ok) return parseError(res, 'Failed to fetch');
    const data: T = await res.json();
    cacheSet(url, data);
    return data;
}

async function parseError(res: Response, fallback: string): Promise<never> {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? fallback);
}

// ── Test Runs ────────────────────────────────────────────────────────────────

export async function getTestRuns(repoId: number): Promise<TestRun[]> {
    return fetchCached(`${BASE}?resource=test-runs&repo_id=${repoId}`);
}

export async function getTestRun(id: string): Promise<TestRun> {
    return fetchCached(`${BASE}?resource=test-runs&id=${encodeURIComponent(id)}`);
}

export async function saveTestRun(testRun: TestRun): Promise<TestRun> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-test-run', testRun }),
    });
    cacheInvalidate('test-runs');
    if (!res.ok) return parseError(res, 'Failed to save test run');
    return res.json();
}

export async function deleteTestRun(id: string): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-test-run', id }),
    });
    cacheInvalidate('test-runs');
    if (!res.ok) return parseError(res, 'Failed to delete test run');
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(repoId: number): Promise<Agent[]> {
    return fetchCached(`${BASE}?resource=agents&repo_id=${repoId}`);
}

export async function getAgent(id: string): Promise<Agent> {
    return fetchCached(`${BASE}?resource=agents&id=${encodeURIComponent(id)}`);
}

export async function saveAgent(agent: Agent): Promise<Agent> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-agent', agent }),
    });
    cacheInvalidate('agents');
    if (!res.ok) return parseError(res, 'Failed to save agent');
    return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-agent', id }),
    });
    cacheInvalidate('agents');
    if (!res.ok) return parseError(res, 'Failed to delete agent');
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function getProject(repoId: number): Promise<Project> {
    return fetchCached(`${BASE}?resource=projects&repo_id=${repoId}`);
}

export async function saveProject(project: Project): Promise<Project> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-project', project }),
    });
    cacheInvalidate('projects');
    if (!res.ok) return parseError(res, 'Failed to save project');
    return res.json();
}

export async function deleteProject(repoId: number): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-project', repo_id: repoId }),
    });
    cacheInvalidate('projects');
    if (!res.ok) return parseError(res, 'Failed to delete project');
}

export async function projectExists(repoId: number): Promise<boolean> {
    try {
        await getProject(repoId);
        return true;
    } catch {
        return false;
    }
}

export async function upsertProject(repoId: number, url?: string): Promise<Project> {
    return saveProject({ repo_id: repoId, url });
}

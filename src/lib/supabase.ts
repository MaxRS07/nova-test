import type { TestRun, Agent, Project } from '@/types/nova';

const BASE = '/api/sb';

async function parseError(res: Response, fallback: string): Promise<never> {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? fallback);
}

// ── Test Runs ────────────────────────────────────────────────────────────────

export async function getTestRuns(repoId: number): Promise<TestRun[]> {
    const res = await fetch(`${BASE}?resource=test-runs&repo_id=${repoId}`);
    if (!res.ok) return parseError(res, 'Failed to fetch test runs');
    return res.json();
}

export async function getTestRun(id: string): Promise<TestRun> {
    const res = await fetch(`${BASE}?resource=test-runs&id=${encodeURIComponent(id)}`);
    if (!res.ok) return parseError(res, 'Failed to fetch test run');
    return res.json();
}

export async function saveTestRun(testRun: TestRun): Promise<TestRun> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-test-run', testRun }),
    });
    if (!res.ok) return parseError(res, 'Failed to save test run');
    return res.json();
}

export async function deleteTestRun(id: string): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-test-run', id }),
    });
    if (!res.ok) return parseError(res, 'Failed to delete test run');
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(repoId: number): Promise<Agent[]> {
    const res = await fetch(`${BASE}?resource=agents&repo_id=${repoId}`);
    if (!res.ok) return parseError(res, 'Failed to fetch agents');
    return res.json();
}

export async function getAgent(id: string): Promise<Agent> {
    const res = await fetch(`${BASE}?resource=agents&id=${encodeURIComponent(id)}`);
    if (!res.ok) return parseError(res, 'Failed to fetch agent');
    return res.json();
}

export async function saveAgent(agent: Agent): Promise<Agent> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-agent', agent }),
    });
    if (!res.ok) return parseError(res, 'Failed to save agent');
    return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-agent', id }),
    });
    if (!res.ok) return parseError(res, 'Failed to delete agent');
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function getProject(repoId: number): Promise<Project> {
    const res = await fetch(`${BASE}?resource=projects&repo_id=${repoId}`);
    if (!res.ok) return parseError(res, 'Failed to fetch project');
    return res.json();
}

export async function saveProject(project: Project): Promise<Project> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-project', project }),
    });
    if (!res.ok) return parseError(res, 'Failed to save project');
    return res.json();
}

export async function deleteProject(repoId: number): Promise<void> {
    const res = await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-project', repo_id: repoId }),
    });
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

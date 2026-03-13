import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import type { TestRun, Agent, Project } from '@/types/nova';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing');
}

function getClient() {
    return createClient(supabaseUrl, supabaseKey);
}

function getGithubId(request: Request): string | null {
    const cookie = request.headers.get('cookie') ?? '';
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (!match) return null;
    const payload = verifyJWT(decodeURIComponent(match[1]));
    if (!payload?.github_id) return null;
    return String(payload.github_id);
}

// Map camelCase Agent → snake_case DB row
// Only include id if it looks like a uuid (i.e. came from the DB), so inserts let the DB generate it
function agentToRow(agent: Agent, userId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agent.id ?? '');
    return {
        ...(isUuid ? { id: agent.id } : {}),
        user_id: userId,
        repo_id: agent.repo_id ?? null,
        name: agent.name,
        actions: agent.actions,
        context: agent.context,
        file_names: agent.fileNames,
        config: agent.config,
        selected_tools: agent.selectedTools,
    };
}

// Map snake_case DB row → camelCase Agent
function rowToAgent(row: Record<string, any>): Agent {
    return {
        id: row.id,
        repo_id: row.repo_id,
        name: row.name,
        actions: row.actions,
        context: row.context,
        fileNames: row.file_names,
        config: row.config,
        selectedTools: row.selected_tools,
        created: row.created_at,
    };
}

// Map camelCase TestRun → snake_case DB row
function testRunToRow(run: TestRun, userId: string) {
    return {
        id: run.id,
        user_id: userId,
        repo_id: run.repo_id ?? null,
        url: run.url,
        pages: run.pages,
        config: run.config,
        agents: run.agents,
        user_agents: run.userAgents,
        status: run.status,
        timestamp: new Date(run.timestamp).toISOString(),
        faults: run.faults,
        duration: run.duration ?? null,
        logs: run.logs,
        thinking: (run as any).thinking ?? [],
    };
}

// Map snake_case DB row → camelCase TestRun
function rowToTestRun(row: Record<string, any>): TestRun {
    return {
        id: row.id,
        repo_id: row.repo_id,
        url: row.url,
        pages: row.pages,
        config: row.config,
        agents: row.agents,
        userAgents: row.user_agents,
        status: row.status,
        timestamp: row.timestamp ? new Date(row.timestamp).toLocaleString() : '',
        faults: row.faults,
        duration: row.duration,
        logs: row.logs ?? [],
        thinking: row.thinking ?? [],
    };
}

/**
 * GET /api/sb?resource=test-runs&repo_id=...
 * GET /api/sb?resource=test-runs&id=...
 * GET /api/sb?resource=agents&repo_id=...
 * GET /api/sb?resource=agents&id=...
 * GET /api/sb?resource=projects&repo_id=...
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');
    const id = searchParams.get('id');
    const repoId = searchParams.get('repo_id');

    if (!resource) {
        return NextResponse.json({ error: 'Missing resource parameter' }, { status: 400 });
    }

    const supabase = getClient();

    if (resource === 'test-runs') {
        if (id) {
            const { data, error } = await supabase
                .from('test_runs').select('*').eq('id', id).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 404 });
            return NextResponse.json(rowToTestRun(data));
        }
        if (!repoId) {
            return NextResponse.json({ error: 'Missing repo_id or id' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('test_runs').select('*')
            .eq('repo_id', repoId)
            .order('timestamp', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data.map(rowToTestRun));
    }

    if (resource === 'agents') {
        if (id) {
            const { data, error } = await supabase
                .from('agents').select('*').eq('id', id).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 404 });
            return NextResponse.json(rowToAgent(data));
        }
        if (!repoId) {
            return NextResponse.json({ error: 'Missing repo_id or id' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('agents').select('*')
            .eq('repo_id', repoId)
            .order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data.map(rowToAgent));
    }

    if (resource === 'projects') {
        if (!repoId) {
            return NextResponse.json({ error: 'Missing repo_id' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('projects').select('*').eq('repo_id', repoId).single();
        if (error) return NextResponse.json({ error: error.message }, { status: 404 });
        return NextResponse.json(data);
    }

    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
}

/**
 * POST /api/sb
 *   { action: 'save-test-run', testRun }
 *   { action: 'save-agent',    agent }
 *   { action: 'save-project',  project }
 */
export async function POST(request: Request) {
    const userId = getGithubId(request);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: {
        action: string;
        testRun?: TestRun;
        agent?: Agent;
        project?: Project;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action } = body;
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    const supabase = getClient();

    if (action === 'save-test-run') {
        const { testRun } = body;
        if (!testRun) return NextResponse.json({ error: 'Missing testRun' }, { status: 400 });

        const row = testRunToRow(testRun, userId);
        const { data, error } = await supabase
            .from('test_runs')
            .upsert(row, { onConflict: 'id' })
            .select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(rowToTestRun(data), { status: 201 });
    }

    if (action === 'save-agent') {
        const { agent } = body;
        if (!agent) return NextResponse.json({ error: 'Missing agent' }, { status: 400 });

        const row = agentToRow(agent, userId);
        const { data, error } = await supabase
            .from('agents')
            .upsert(row, { onConflict: 'id' })
            .select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(rowToAgent(data), { status: 201 });
    }

    if (action === 'save-project') {
        const { project } = body;
        if (!project) return NextResponse.json({ error: 'Missing project' }, { status: 400 });
        if (!project.repo_id) return NextResponse.json({ error: 'Missing project.repo_id' }, { status: 400 });

        // Only write columns that exist in the schema
        const row = {
            repo_id: project.repo_id,
            url: project.url ?? null,
            user_id: userId,
        };

        const { data, error } = await supabase
            .from('projects')
            .upsert(row, { onConflict: 'repo_id' })
            .select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

/**
 * DELETE /api/sb
 *   { action: 'delete-test-run', id }
 *   { action: 'delete-agent',    id }
 *   { action: 'delete-project',  repo_id }
 */
export async function DELETE(request: Request) {
    const userId = getGithubId(request);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { action: string; id?: string; repo_id?: number };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, id, repo_id } = body;
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    const supabase = getClient();

    if (action === 'delete-test-run') {
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const { error } = await supabase.from('test_runs').delete().eq('id', id).eq('user_id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (action === 'delete-agent') {
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const { error } = await supabase.from('agents').delete().eq('id', id).eq('user_id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (action === 'delete-project') {
        if (!repo_id) return NextResponse.json({ error: 'Missing repo_id' }, { status: 400 });
        const { error } = await supabase.from('projects').delete().eq('repo_id', repo_id).eq('user_id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

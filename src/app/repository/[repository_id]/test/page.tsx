'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { startNovaActJob } from '@/lib/nova';
import { supabase } from '@/lib/supabaseClient';
import { ActRequestBody, Agent, defaultUiAgent, TestRun } from '@/types/nova';
import { getTestRuns, saveTestRun, deleteTestRun, getFaultCounts, getAgents } from '@/lib/supabase';
import TestRunsTable from '../../../../components/TestRunsTable';
import NewTestForm from '../../../../components/NewTestForm';

function isValidUrl(url: string) {
    try { new URL(url); return true; } catch { return false; }
}

export default function TestPage() {
    const params = useParams();
    const repositoryId = Number(params.repository_id);

    const [view, setView] = useState<'list' | 'new'>('list');
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [faultCounts, setFaultCounts] = useState<Record<string, number>>({});
    const [isLoadingTests, setIsLoadingTests] = useState(true);
    const [launchError, setLaunchError] = useState<string | null>(null);

    // Form state
    const [testUrl, setTestUrl] = useState('');
    const [subpages, setSubpages] = useState<string[]>([]);
    const [agentCount, setAgentCount] = useState(4);
    const [isLaunching, setIsLaunching] = useState(false);
    const [userAgents, setUserAgents] = useState<Agent[]>([defaultUiAgent]);
    const [lastUsedAgentId, setLastUsedAgentId] = useState<string | undefined>(undefined);
    const [availableAgents, setAvailableAgents] = useState<Agent[]>([defaultUiAgent]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const channelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});

    useEffect(() => {
        if (!repositoryId) return;
        (async () => {
            try {
                setIsLoadingTests(true);
                const [runs, counts] = await Promise.all([
                    getTestRuns(repositoryId),
                    getFaultCounts(repositoryId),
                ]);
                const sanitised = runs.map(r =>
                    r.status === 'running' && !channelsRef.current[r.id]
                        ? { ...r, status: 'failed' as const }
                        : r
                );

                const last = sanitised[sanitised.length - 1]
                last && last.userAgents[0] && setLastUsedAgentId(last.userAgents[0]);

                setTestRuns(sanitised);
                setFaultCounts(counts);
                for (const orig of runs) {
                    if (orig.status === 'running' && !channelsRef.current[orig.id]) {
                        const fixed = sanitised.find(r => r.id === orig.id)!;
                        saveTestRun(fixed).catch(console.error);
                    }
                }
                getAgents(repositoryId).then(agents => {
                    console.log('Loaded agents:', agents);
                    const allAgents = [defaultUiAgent, ...agents];
                    setAvailableAgents(allAgents);
                }).catch(console.error);
            } catch (err) {
                console.error('Failed to load test runs:', err);
            } finally {
                setIsLoadingTests(false);
            }
        })();

        return () => {
            Object.values(channelsRef.current).forEach(ch => supabase.removeChannel(ch));
            channelsRef.current = {};
        };
    }, [repositoryId]);

    const resetForm = () => {
        setTestUrl('');
        setSubpages([]);
        setAgentCount(4);
        setUserAgents([defaultUiAgent]);
        setFormErrors({});
        setLaunchError(null);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTestUrl(value);
        setFormErrors(prev => {
            const next = { ...prev };
            if (value === '' || isValidUrl(value)) delete next['testUrl'];
            else next['testUrl'] = 'Invalid URL format';
            return next;
        });
    };

    const subscribeToRun = (runId: string) => {
        // Watch for run status/duration updates
        const runChannel = supabase
            .channel(`test-run-list-${runId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'test_runs', filter: `id=eq.${runId}` },
                ({ new: row }) => {
                    const updated: TestRun = {
                        id: row.id,
                        repo_id: row.repo_id,
                        url: row.url,
                        pages: row.pages,
                        config: row.config,
                        agents: row.agents,
                        userAgents: row.user_agents,
                        status: row.status,
                        timestamp: row.timestamp ? new Date(row.timestamp).toLocaleString() : '',
                        duration: row.duration,
                    };
                    setTestRuns(prev => prev.map(r => r.id === runId ? updated : r));
                    if (updated.status !== 'running') {
                        supabase.removeChannel(runChannel);
                        supabase.removeChannel(faultChannel);
                        delete channelsRef.current[runId];
                        setIsLaunching(false);
                    }
                }
            )
            .subscribe();

        // Watch for incoming fault events to keep the count live
        const faultChannel = supabase
            .channel(`test-run-faults-${runId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'test_run_events', filter: `run_id=eq.${runId}` },
                ({ new: row }) => {
                    if (row.type === 'fault') {
                        setFaultCounts(prev => ({ ...prev, [runId]: (prev[runId] ?? 0) + 1 }));
                    }
                }
            )
            .subscribe();

        channelsRef.current[runId] = runChannel;
    };

    const handleLaunchTests = async () => {
        setIsLaunching(true);
        setLaunchError(null);

        const actRequest: ActRequestBody = {
            session_id: `session-${Date.now()}`,
            url: testUrl,
            pages: subpages,
            agent_config: userAgents,
        };

        try {
            const runId = await startNovaActJob(actRequest);

            const newRun: TestRun = {
                id: runId,
                repo_id: repositoryId,
                url: testUrl,
                pages: subpages,
                config: 'default',
                agents: agentCount,
                userAgents: userAgents.map(a => a.id),
                status: 'running',
                timestamp: new Date().toISOString(),
                duration: '—',
            };

            setTestRuns(prev => [newRun, ...prev]);
            setFaultCounts(prev => ({ ...prev, [runId]: 0 }));
            await saveTestRun(newRun);
            subscribeToRun(runId);
        } catch (error) {
            setLaunchError(error instanceof Error ? error.message : 'Failed to launch test fleet');
            setIsLaunching(false);
        }

        setView('list');
    };

    const handleDeleteTestRun = async (runId: string) => {
        const channel = channelsRef.current[runId];

        if (channel) {
            supabase.removeChannel(channel);
            delete channelsRef.current[runId];
            const cancelled = testRuns.find(r => r.id === runId);
            if (cancelled) {
                const updated = { ...cancelled, status: 'cancelled' as const };
                setTestRuns(prev => prev.map(r => r.id === runId ? updated : r));
                saveTestRun(updated).catch(console.error);
            }
        } else {
            try {
                await deleteTestRun(runId);
                setTestRuns(prev => prev.filter(r => r.id !== runId));
                setFaultCounts(prev => { const u = { ...prev }; delete u[runId]; return u; });
            } catch (err) {
                setLaunchError(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--background)]">
            <Topbar />

            {launchError && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl">
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mx-4 shadow-lg backdrop-blur-xl flex items-start gap-3">
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-rose-500 mb-1">Error</h3>
                            <p className="text-sm text-rose-500/80 font-mono">{launchError}</p>
                        </div>
                        <button onClick={() => setLaunchError(null)} className="text-rose-500/60 hover:text-rose-500 transition-colors">✕</button>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-10 py-12">
                        {view === 'list' ? (
                            <TestRunsTable
                                repositoryId={repositoryId}
                                testRuns={testRuns}
                                faultCounts={faultCounts}
                                isLoading={isLoadingTests}
                                onDelete={handleDeleteTestRun}
                                onNew={() => { resetForm(); setView('new'); }}
                            />
                        ) : (
                            <NewTestForm
                                repositoryId={repositoryId}
                                testUrl={testUrl}
                                subpages={subpages}
                                agentCount={agentCount}
                                userAgents={userAgents}
                                lastUsedAgentId={lastUsedAgentId}
                                availableAgents={availableAgents}
                                isLaunching={isLaunching}
                                formErrors={formErrors}
                                onUrlChange={handleUrlChange}
                                onSubpagesChange={setSubpages}
                                onAgentCountChange={setAgentCount}
                                onUserAgentsChange={setUserAgents}
                                onLaunch={handleLaunchTests}
                                onBack={() => setView('list')}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

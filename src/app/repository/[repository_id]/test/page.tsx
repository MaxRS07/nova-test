'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { startNovaActJob } from '@/lib/nova';
import { ActRequestBody, defaultUiAgent, TestRun } from '@/types/nova';
import { getTestRuns, saveTestRun, deleteTestRun } from '@/lib/supabase';
import TestRunsTable from '../../../../components/TestRunsTable';
import NewTestForm from '../../../../components/NewTestForm';

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function isValidUrl(url: string) {
    try { new URL(url); return true; } catch { return false; }
}

export default function TestPage() {
    const params = useParams();
    const repositoryId = Number(params.repository_id);

    const [view, setView] = useState<'list' | 'new'>('list');
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [activeSockets, setActiveSockets] = useState<Record<string, any>>({});
    const [isLoadingTests, setIsLoadingTests] = useState(true);
    const [launchError, setLaunchError] = useState<string | null>(null);

    // Form state
    const [testUrl, setTestUrl] = useState('');
    const [subpages, setSubpages] = useState<string[]>([]);
    const [agentCount, setAgentCount] = useState(4);
    const [isLaunching, setIsLaunching] = useState(false);
    const [userAgents, setUserAgents] = useState<string[]>(['default-ui-agent']);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Persist runs to sessionStorage for detail page
    useEffect(() => {
        for (const run of testRuns) {
            sessionStorage.setItem(`test-run-${run.id}`, JSON.stringify(run));
        }
    }, [testRuns]);

    // Load runs from DB; sanitise any 'running' runs that have no active socket
    useEffect(() => {
        if (!repositoryId) return;
        (async () => {
            try {
                setIsLoadingTests(true);
                const runs = await getTestRuns(repositoryId);
                const sanitised = runs.map(r =>
                    r.status === 'running' ? { ...r, status: 'failed' as const } : r
                );
                setTestRuns(sanitised);
                // Persist corrected status back to DB
                for (const orig of runs) {
                    if (orig.status === 'running') {
                        const fixed = sanitised.find(r => r.id === orig.id)!;
                        saveTestRun(fixed).catch(console.error);
                    }
                }
            } catch (err) {
                console.error('Failed to load test runs:', err);
            } finally {
                setIsLoadingTests(false);
            }
        })();
    }, [repositoryId]);

    const resetForm = () => {
        setTestUrl('');
        setSubpages([]);
        setAgentCount(4);
        setUserAgents(['default-ui-agent']);
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

    const handleLaunchTests = async () => {
        setIsLaunching(true);
        setLaunchError(null);

        const actRequest: ActRequestBody = {
            session_id: `session-${Date.now()}`,
            url: testUrl,
            pages: subpages,
            agent_config: [defaultUiAgent],
        };

        try {
            const actSocket = await startNovaActJob(actRequest);
            const runId = actSocket.getRunId();

            const newRun: TestRun = {
                id: runId,
                repo_id: repositoryId,
                url: testUrl,
                pages: subpages,
                config: 'default',
                agents: agentCount,
                userAgents: [...userAgents],
                status: 'running',
                timestamp: new Date().toISOString(),
                faults: [],
                duration: '—',
                logs: [],
                thinking: [],
            };

            setTestRuns(prev => [newRun, ...prev]);
            setActiveSockets(prev => ({ ...prev, [runId]: actSocket }));
            saveTestRun(newRun).catch(console.error);

            const startTime = Date.now();

            actSocket.onApprovalRequest = async () => true;

            actSocket.onMetadataUpdate = (metadata) => {
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? { ...r, tests: metadata.num_steps_executed } : r
                ));
            };

            actSocket.onFault = (faults) => {
                if (Array.isArray(faults)) {
                    setTestRuns(prev => prev.map(r =>
                        r.id === runId ? { ...r, faults: [...r.faults, ...faults] } : r
                    ));
                }
            };

            actSocket.onThinking = (message: string) => {
                setTestRuns(prev => prev.map(r => {
                    if (r.id !== runId) return r;
                    const last = r.thinking[r.thinking.length - 1];
                    if (last) {
                        const curr = message.match(/\*> (.)/);
                        const prev2 = last.match(/\*> (.)/);
                        if (curr && prev2 && curr[1] === prev2[1]) return r;
                    }
                    return { ...r, thinking: [...r.thinking, message] };
                }));
            };

            const finishRun = (finalStatus: 'completed' | 'failed') => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                setTestRuns(prev => {
                    const next = prev.map(r => {
                        if (r.id !== runId) return r;
                        const updated = {
                            ...r,
                            status: finalStatus,
                            duration: formatDuration(elapsed),
                        };
                        saveTestRun(updated).catch(console.error);
                        return updated;
                    });
                    return next;
                });
                setActiveSockets(prev => { const u = { ...prev }; delete u[runId]; return u; });
                setIsLaunching(false);
            };

            actSocket.onClose = () => finishRun('completed');

            actSocket.onError = (error: any) => {
                const msg = error instanceof Error ? error.message : String(error);
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? { ...r, logs: [...r.logs, `Error: ${msg}`] } : r
                ));
                finishRun('failed');
            };
        } catch (error) {
            setLaunchError(error instanceof Error ? error.message : 'Failed to launch test fleet');
            setIsLaunching(false);
        }

        setView('list');
    };

    const handleDeleteTestRun = async (runId: string) => {
        const socket = activeSockets[runId];

        if (socket) {
            // Running — cancel and mark cancelled
            try {
                socket.cancel?.();
                socket.close?.();
            } catch (err) {
                console.error('Failed to close socket:', err);
            }
            setTestRuns(prev => {
                const next = prev.map(r =>
                    r.id === runId ? { ...r, status: 'cancelled' as const } : r
                );
                const run = next.find(r => r.id === runId);
                if (run) saveTestRun(run).catch(console.error);
                return next;
            });
            setActiveSockets(prev => { const u = { ...prev }; delete u[runId]; return u; });
        } else {
            // Not running — delete from DB
            try {
                await deleteTestRun(runId);
                setTestRuns(prev => prev.filter(r => r.id !== runId));
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

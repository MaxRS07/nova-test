'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Dropdown from '@/components/Dropdown';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InfoIcon from '@/components/InfoIcon';
import { startNovaActJob } from '@/lib/nova';
import { ActRequestBody, defaultUiAgent, TestRun } from '@/types/nova';
import { getTestRuns, saveTestRun, deleteTestRun } from '@/lib/supabase';

export default function TestPage() {
    const params = useParams();
    const repositoryId = Number(params.repository_id);
    const router = useRouter();

    const [view, setView] = useState<'list' | 'new'>('list');
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [activeSockets, setActiveSockets] = useState<Record<string, any>>({});

    // Persist test runs to sessionStorage so the detail page can read them
    useEffect(() => {
        for (const run of testRuns) {
            sessionStorage.setItem(`test-run-${run.id}`, JSON.stringify(run));
        }
    }, [testRuns]);

    // Form state
    const [testUrl, setTestUrl] = useState<string>('');
    const [subpages, setSubpages] = useState<string[]>([]);
    const [agentCount, setAgentCount] = useState(4);
    const [isLaunching, setIsLaunching] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState('default');
    const [lastUsedConfig, setLastUsedConfig] = useState('default');
    const [userAgents, setUserAgents] = useState<string[]>(['default-ui-agent']);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [launchError, setLaunchError] = useState<string | null>(null);

    // Load test runs from database on mount
    useEffect(() => {
        const loadTestRuns = async () => {
            try {
                const runs = await getTestRuns(repositoryId);
                setTestRuns(runs);
            } catch (error) {
                console.error('Failed to load test runs:', error);
            }
        };

        if (repositoryId) {
            loadTestRuns();
        }
    }, [repositoryId]);

    const isValidUrl = (url: string) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTestUrl(value);

        if (value === '' || isValidUrl(value)) {
            setFormErrors(prev => {
                const updated = { ...prev };
                delete updated['testUrl'];
                return updated;
            });
        } else {
            setFormErrors(prev => ({
                ...prev,
                testUrl: 'Invalid URL format'
            }));
        }
    };

    const formathhmmss = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs.toPrecision(2)}s`;
    };

    const handleLaunchTests = async () => {
        setIsLaunching(true);
        setLaunchError(null);

        const actRequest: ActRequestBody = {
            session_id: `session-${Date.now()}`,
            url: testUrl,
            pages: subpages,
            agent_config: [defaultUiAgent]
        };

        try {
            const actSocket = await startNovaActJob(actRequest);

            const runId = actSocket.getRunId();

            const newRun: TestRun = {
                id: runId,
                repo_id: repositoryId,
                url: testUrl,
                pages: subpages,
                config: selectedConfig,
                agents: agentCount,
                userAgents: [...userAgents],
                status: 'running',
                timestamp: new Date().toLocaleString(),
                faults: [],
                duration: '—',
                logs: [],
            };

            setTestRuns(prev => [newRun, ...prev]);
            // Store socket reference for this run
            setActiveSockets(prev => ({ ...prev, [runId]: actSocket }));

            const startTime = Date.now();

            // Save new test run to database
            try {
                await saveTestRun(newRun);
            } catch (error) {
                console.error('Failed to save test run:', error);
            }

            actSocket.onApprovalRequest = async (message: string) => {
                console.log("Approval request:", message);
                return true;
            };

            actSocket.onMetadataUpdate = (metadata) => {
                console.log("Metadata update:", metadata);
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? { ...r, tests: metadata.num_steps_executed, logs: [...r.logs, `Metadata: ${JSON.stringify(metadata)}`] } : r
                ));
            };

            actSocket.onActUpdate = (update, metadata) => {
                console.log("Act update:", update, metadata);
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? { ...r, logs: [...r.logs, `Update: ${JSON.stringify(update)}`] } : r
                ));
            };

            actSocket.onClose = () => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                const updatedRun = { ...newRun, status: newRun.status === 'running' ? 'completed' as const : newRun.status, duration: formathhmmss(elapsed) };
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? updatedRun : r
                ));

                // Save completed test run to database
                saveTestRun(updatedRun).catch(error => {
                    console.error('Failed to save completed test run:', error);
                });

                // Clean up socket reference
                setActiveSockets(prev => {
                    const updated = { ...prev };
                    delete updated[runId];
                    return updated;
                });

                setIsLaunching(false);
            };

            actSocket.onError = (error) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error("Act socket error:", error);
                const failedRun = { ...newRun, status: 'failed' as const, logs: [...newRun.logs, `Error: ${errorMessage}`] };
                setTestRuns(prev => prev.map(r =>
                    r.id === runId ? failedRun : r
                ));

                // Save failed test run to database
                saveTestRun(failedRun).catch(err => {
                    console.error('Failed to save error test run:', err);
                });

                // Clean up socket reference
                setActiveSockets(prev => {
                    const updated = { ...prev };
                    delete updated[runId];
                    return updated;
                });

                setIsLaunching(false);
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to launch test fleet';
            console.error("Failed to launch test fleet:", error);
            setLaunchError(errorMessage);
            setIsLaunching(false);
        }
        setView('list');
    };

    const resetForm = () => {
        setTestUrl('');
        setSubpages([]);
        setAgentCount(4);
        setSelectedConfig('default');
        setUserAgents(['default-ui-agent']);
        setFormErrors({});
        setLaunchError(null);
    };

    const handleDeleteTestRun = async (runId: string) => {
        const socket = activeSockets[runId];

        if (socket && typeof socket.close === 'function') {
            // Test is running - close the socket
            try {
                socket.close();
                setActiveSockets(prev => {
                    const updated = { ...prev };
                    delete updated[runId];
                    return updated;
                });
            } catch (error) {
                console.error('Failed to close test run socket:', error);
                setLaunchError(`Failed to stop test: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } else {
            // Test is not running - delete it
            try {
                await deleteTestRun(runId);
                setTestRuns(prev => prev.filter(r => r.id !== runId));
            } catch (error) {
                console.error('Failed to delete test run:', error);
                setLaunchError(`Failed to delete test run: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    const statusBadge = (status: TestRun['status']) => {
        const styles = {
            running: 'bg-blue-500/15 text-blue-400',
            completed: 'bg-emerald-500/15 text-emerald-400',
            failed: 'bg-rose-500/15 text-rose-400',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-mono ${styles[status]}`}>
                {status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />}
                {status}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--background)]">
            <Topbar />

            {/* Error Notification */}
            {launchError && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-1/2">
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mx-4 shadow-lg backdrop-blur-xl">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-rose-500 mb-1">Launch Failed</h3>
                                <p className="text-sm text-rose-500/80 font-mono">{launchError}</p>
                            </div>
                            <button
                                onClick={() => setLaunchError(null)}
                                className="text-rose-500/60 hover:text-rose-500 transition-colors flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />

                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-10 py-12">

                        {view === 'list' ? (
                            <>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
                                        <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Test Runs</h1>
                                    </div>
                                    <button
                                        onClick={() => { resetForm(); setView('new'); }}
                                        className="px-4 py-2.5 rounded-lg text-sm font-mono font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                                    >
                                        New Test
                                    </button>
                                </div>

                                {/* Test Runs Table */}
                                <div className="bg-[var(--surface)] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <div className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_0.8fr_0.5fr] px-6 py-3 bg-[var(--muted-bg)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        {['url', 'status', 'agents', 'faults detected', 'time', 'duration', ''].map((col) => (
                                            <span key={col} className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">{col}</span>
                                        ))}
                                    </div>
                                    {testRuns.length === 0 ? (
                                        <div className="px-6 py-16 text-center">
                                            <p className="text-sm text-[var(--muted)] font-mono mb-1">No test runs yet</p>
                                            <p className="text-xs text-[var(--muted)] font-mono">Click &quot;New Test&quot; to launch your first test fleet</p>
                                        </div>
                                    ) : (
                                        testRuns.map((run, i) => (
                                            <div
                                                key={run.id}
                                                className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_0.8fr_0.5fr] px-6 py-4 hover:bg-[var(--muted-bg)] transition-colors items-center"
                                                style={i < testRuns.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
                                                onClick={() => router.push(`/repository/${repositoryId}/test/${run.id}`)}
                                            >
                                                <span
                                                    className="font-mono text-sm text-[var(--foreground)] truncate pr-4 cursor-pointer hover:underline"
                                                    title={run.url}
                                                >
                                                    {run.url}
                                                </span>
                                                <span>{statusBadge(run.status)}</span>
                                                <span className="font-mono text-sm text-[var(--foreground)]">{run.agents}</span>
                                                <span className={`font-mono text-sm ${run.faults.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{run.faults.length}</span>
                                                <span className="font-mono text-sm text-[var(--foreground-soft)]">{run.timestamp}</span>
                                                <span className="font-mono text-sm text-[var(--muted)]">{run.duration}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTestRun(run.id);
                                                    }}
                                                    className={`px-2 py-1 text-xs font-mono rounded transition-colors ${run.status === 'running'
                                                        ? 'text-amber-500 hover:bg-amber-500/10'
                                                        : 'text-red-500 hover:bg-red-500/10'
                                                        }`}
                                                    title={run.status === 'running' ? 'Stop test run' : 'Delete test run'}
                                                >
                                                    {run.status === 'running' ? '⊗' : '✕'}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* New Test Form */}
                                <div className="mb-5">
                                    <button
                                        onClick={() => setView('list')}
                                        className="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
                                    >
                                        Back to Test Runs
                                    </button>
                                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
                                    <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight mb-2">New Test Fleet</h1>
                                    <p className="text-sm text-[var(--muted)] font-mono">Configure and launch your agent-powered test execution</p>
                                </div>

                                {/* Configuration Section */}
                                <div className="bg-[var(--surface)] rounded-xl p-6 mb-8" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-6">Agent Configuration</p>
                                    {/* <span className="text-sm font-mono text-[var(--foreground-soft)] mb-3 block">Configuration Profile
                                        <InfoIcon text="Configure your test fleet by selecting an agent configuration profile, customizing user agents for diverse test execution, and setting the number of parallel agents to optimize testing speed." />
                                    </span>

                                    <div className="mb-6">
                                        <Dropdown
                                            options={[
                                                { value: 'default', label: 'Default Config' },
                                                { value: 'config1', label: 'Config 1' },
                                                { value: 'config2', label: 'Config 2' },
                                            ]}
                                            value={selectedConfig}
                                            onChange={setSelectedConfig}
                                            onCreate={() => { }}
                                            lastUsedValue={lastUsedConfig}
                                        />
                                    </div> */}
                                    {/* Edit Agent */}
                                    <div>
                                        <span className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">
                                            User Agents
                                            <InfoIcon text="Select user agents to simulate different browsers and devices during test execution. The agent's exploratory behavior can also be configured." />
                                        </span>
                                        <div className="space-y-3">
                                            {userAgents.map((agent, i) => (
                                                <div key={i} className="flex gap-3 items-center">
                                                    <div className="flex-1">
                                                        <Dropdown
                                                            options={[{ value: 'default-ui-agent', label: 'Default UI Testing Agent' }]}
                                                            value={agent}
                                                            onChange={(value) => setUserAgents(prev => {
                                                                const updated = [...prev];
                                                                updated[i] = value;
                                                                return updated;
                                                            })}
                                                            onCreate={() => router.push(`/repository/${repositoryId}/agents/new`)}
                                                            lastUsedValue={''}
                                                        />
                                                    </div>
                                                    {userAgents.length > 1 &&
                                                        <button
                                                            onClick={() => setUserAgents(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-[var(--border-subtle)] whitespace-nowrap"
                                                        >
                                                            Remove
                                                        </button>
                                                    }
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type='button'
                                            onClick={() => userAgents.length < 5 && setUserAgents(prev => [...prev, 'default-ui-agent'])}
                                            disabled={userAgents.length >= 5}
                                            className="mt-3 px-3 py-2 text-xs font-mono text-[var(--accent)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors border border-[var(--border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            + Add Agent
                                        </button>
                                        <span className="text-xs text-[var(--muted)] font-mono mt-2 block">{userAgents.length}/5</span>
                                    </div>
                                    {/* Agent Count */}
                                    <div className="mt-4 mb-8">
                                        <label className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">
                                            Parallel Agents
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="1"
                                                max="8"
                                                value={agentCount}
                                                onChange={(e) => setAgentCount(parseInt(e.target.value))}
                                                className="flex-1 h-2 rounded-full bg-[var(--muted-bg)] outline-none"
                                            />
                                            <div className="w-16 bg-[var(--muted-bg)] rounded-lg px-4 py-2 text-center">
                                                <span className="font-mono font-bold text-[var(--foreground)]">{agentCount}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[var(--muted)] font-mono mt-2">Higher agent count = faster parallel test execution</p>
                                    </div>

                                    {/* Test URL */}
                                    <div>
                                        <label className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">
                                            <span className="flex items-center gap-4">
                                                Test URL
                                                <InfoIcon text="URL of your application to test. The test fleet will spawn at this URL and sub-pages." />
                                            </span>

                                            <input
                                                id='testUrl'
                                                name='testUrl'
                                                type='text'
                                                value={testUrl}
                                                onChange={handleUrlChange}
                                                placeholder={"https://myapp.com"}
                                                className={`mt-4 w-full flex-1 p-3 rounded-lg border transition-all text-left font-mono text-sm bg-[var(--background)] ${formErrors['testUrl']
                                                    ? 'border-rose-500 focus:outline-none'
                                                    : 'border-[var(--border-subtle)]'
                                                    }`}
                                            />
                                            {formErrors['testUrl'] && (
                                                <p className="text-xs text-rose-500 font-mono mt-2">{formErrors['testUrl']}</p>
                                            )}
                                        </label>
                                        {subpages.length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-xs text-[var(--muted)] font-mono mb-3">Subpages</p>
                                                <div className="space-y-2">
                                                    {subpages.map((subpage, index) => (
                                                        <div key={index} className="flex gap-2 items-center">
                                                            <span className="text-[var(--muted)] text-sm font-mono">/</span>
                                                            <input
                                                                id={`subpage-${index}`}
                                                                type='text'
                                                                value={subpage}
                                                                onChange={(e) => {
                                                                    const updated = [...subpages];
                                                                    updated[index] = e.target.value;
                                                                    setSubpages(updated);
                                                                }}
                                                                placeholder={"dashboard"}
                                                                className="flex-1 p-3 rounded-lg border border-[var(--border-subtle)] transition-all text-left font-mono text-sm bg-[var(--background)]"
                                                            />
                                                            <button
                                                                onClick={() => setSubpages(subpages.filter((_, i) => i !== index))}
                                                                className="px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            type='button'
                                            title='Add subpage'
                                            onClick={() => setSubpages(prev => [...prev, ''])}
                                            className="mt-3 px-3 py-2 text-xs font-mono text-[var(--accent)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors border border-[var(--border-subtle)]"
                                        >
                                            + Add Subpage
                                        </button>
                                    </div>
                                </div>

                                {/* Launch Section */}
                                <div className="bg-[var(--surface)] rounded-xl p-6 mb-8" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-4">Ready to start</p>
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div>
                                            <p className="text-xs text-[var(--muted)] font-mono mb-1">agents</p>
                                            <p className="text-2xl font-mono font-bold text-foreground">{agentCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[var(--muted)] font-mono mb-1">estimated runtime</p>
                                            <p className="text-2xl font-mono font-bold text-blue-500">{formathhmmss(90 / agentCount)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleLaunchTests}
                                        disabled={isLaunching || !isValidUrl(testUrl) || Object.keys(formErrors).length > 0}
                                        className={`w-full py-3 rounded-lg font-semibold transition-all border ${isLaunching || !isValidUrl(testUrl) || Object.keys(formErrors).length > 0
                                            ? 'text-[var(--muted)] cursor-not-allowed border-[var(--muted)]'
                                            : 'text-white hover:shadow-lg hover:cursor-pointer '
                                            }`}
                                        style={isLaunching || !isValidUrl(testUrl) || Object.keys(formErrors).length > 0
                                            ? { borderColor: 'var(--border)' }
                                            : { borderColor: 'var(--muted)' }}
                                    >
                                        {isLaunching ? 'Launching Test Fleet...' : 'Launch Test Fleet'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

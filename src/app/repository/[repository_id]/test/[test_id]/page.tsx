'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useParams, useRouter } from 'next/navigation';
import { TestRun, TestRunStatus } from '@/types/nova';

export default function TestDetailPage() {
    const params = useParams();
    const repositoryId = params.repository_id;
    const testId = params.test_id as string;
    const router = useRouter();

    // In a real app this would come from a shared store or API.
    // For now we read from sessionStorage which the list page writes to.
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(`test-run-${testId}`) : null;
    const run = stored ? JSON.parse(stored) as TestRun : null;

    const statusBadge = (status: TestRunStatus) => {
        const styles = {
            running: 'bg-blue-500/15 text-blue-400',
            completed: 'bg-emerald-500/15 text-emerald-400',
            failed: 'bg-rose-500/15 text-rose-400',
        };
        return (
            <span className={`px-2.5 py-1 rounded text-xs font-mono ${styles[status]}`}>
                {status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />}
                {status}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--background)]">
            <Topbar />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-10 py-12">
                        <button
                            onClick={() => router.push(`/repository/${repositoryId}/test`)}
                            className="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
                        >
                            Back to Test Runs
                        </button>

                        {!run ? (
                            <div className="bg-[var(--surface)] rounded-xl p-10 text-center" style={{ border: '1px solid var(--border-subtle)' }}>
                                <p className="text-sm text-[var(--muted)] font-mono mb-2">Test run not found</p>
                                <p className="text-xs text-[var(--muted)] font-mono">This test run may have expired from the current session.</p>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Test Run</h1>
                                        {statusBadge(run.status)}
                                    </div>
                                    <p className="text-sm text-[var(--muted)] font-mono">{run.url}</p>
                                </div>

                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    {[
                                        { label: 'Status', value: run.status, color: run.status === 'running' ? 'text-blue-400' : run.status === 'completed' ? 'text-emerald-400' : 'text-rose-400' },
                                        { label: 'Agents', value: run.agents, color: 'text-[var(--foreground)]' },
                                        { label: 'Faults Detected', value: run.faults, color: run.faults > 0 ? 'text-rose-500' : 'text-emerald-500' },
                                    ].map((card) => (
                                        <div key={card.label} className="bg-[var(--surface)] rounded-xl p-4" style={{ border: '1px solid var(--border-subtle)' }}>
                                            <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider mb-1">{card.label}</p>
                                            <p className={`text-2xl font-mono font-bold ${card.color}`}>{card.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Details */}
                                <div className="bg-[var(--surface)] rounded-xl p-6 mb-8" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-4">Details</p>
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm font-mono">
                                        <div>
                                            <span className="text-[var(--muted)]">Config:</span>{' '}
                                            <span className="text-[var(--foreground)]">{run.config}</span>
                                        </div>
                                        <div>
                                            <span className="text-[var(--muted)]">Duration:</span>{' '}
                                            <span className="text-[var(--foreground)]">{run.duration}</span>
                                        </div>
                                        <div>
                                            <span className="text-[var(--muted)]">Started:</span>{' '}
                                            <span className="text-[var(--foreground)]">{run.timestamp}</span>
                                        </div>
                                        {run.pages.length > 0 && (
                                            <div className="col-span-2">
                                                <span className="text-[var(--muted)]">Pages:</span>{' '}
                                                <span className="text-[var(--foreground)]">{run.pages.join(', ')}</span>
                                            </div>
                                        )}
                                        <div className="col-span-2">
                                            <span className="text-[var(--muted)]">User Agents:</span>{' '}
                                            <span className="text-[var(--foreground)]">{run.userAgents.join(', ')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Output Log */}
                                <div className="bg-[var(--surface)] rounded-xl overflow-hidden mb-8" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <div className="px-6 py-4 bg-[var(--muted-bg)] flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Output Log</p>
                                        {run.status === 'running' && (
                                            <span className="text-xs font-mono text-blue-400 flex items-center gap-1.5">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                Live
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-6 max-h-96 overflow-y-auto">
                                        {run.logs.length === 0 ? (
                                            <p className="text-sm text-[var(--muted)] font-mono">
                                                {run.status === 'running' ? 'Waiting for output...' : 'No output recorded'}
                                            </p>
                                        ) : (
                                            <div className="space-y-1">
                                                {run.logs.map((log, i) => (
                                                    <div key={i} className="text-xs font-mono text-[var(--foreground-soft)] leading-relaxed break-all flex flex-row">
                                                        <span className="text-[var(--muted)] mr-2 select-none">{String(i + 1).padStart(3, ' ')}</span>
                                                        {log}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                { /* Git Revision */}
                                <div className="bg-[var(--surface)] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <div className="px-6 py-4 bg-[var(--muted-bg)] flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">git revision</p>
                                    </div>
                                    <div className="p-6" />
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useParams, useRouter } from 'next/navigation';
import { TestRun, TestRunStatus } from '@/types/nova';
import { useState, useEffect } from 'react';

export default function TestDetailPage() {
    const params = useParams();
    const repositoryId = Number(params.repository_id);
    const testId = params.test_id as string;
    const router = useRouter();
    const [outputTab, setOutputTab] = useState<'output' | 'thinking'>('output');
    const [run, setRun] = useState<TestRun | null>(null);

    useEffect(() => {
        const read = () => {
            const stored = sessionStorage.getItem(`test-run-${testId}`);
            if (stored) setRun(JSON.parse(stored) as TestRun);
        };
        read();
        // Poll while the run might still be active
        const interval = setInterval(() => {
            const stored = sessionStorage.getItem(`test-run-${testId}`);
            if (!stored) return;
            const parsed = JSON.parse(stored) as TestRun;
            setRun(parsed);
            if (parsed.status !== 'running') clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
    }, [testId]);

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
                                </div>

                                { /* Test URL */}
                                <div className='bg-[var(--surface)] rounded-xl p-4 mb-6' style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider mb-1">URL</p>
                                    <a href={run.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-[var(--accent)] hover:underline">
                                        {run.url}
                                    </a>
                                </div>

                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    {[
                                        { label: 'Status', value: run.status, color: run.status === 'running' ? 'text-blue-400' : run.status === 'completed' ? 'text-emerald-400' : 'text-rose-400' },
                                        { label: 'Agents', value: run.agents, color: 'text-[var(--foreground)]' },
                                        { label: 'Faults Detected', value: run.faults.length, color: run.faults.length > 0 ? 'text-rose-500' : 'text-emerald-500' },
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
                                            <span className="text-[var(--foreground)]">{new Date(run.timestamp).toLocaleString()}</span>
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
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setOutputTab('output')}
                                                className={`text-xs font-mono uppercase tracking-wider pb-2 border-b-2 transition-colors ${outputTab === 'output'
                                                    ? 'text-[var(--foreground)] border-[var(--accent)]'
                                                    : 'text-[var(--muted)] border-transparent hover:text-[var(--foreground)]'
                                                    }`}
                                            >
                                                Output Log
                                            </button>
                                            <button
                                                onClick={() => setOutputTab('thinking')}
                                                className={`text-xs font-mono uppercase tracking-wider pb-2 border-b-2 transition-colors ${outputTab === 'thinking'
                                                    ? 'text-[var(--foreground)] border-[var(--accent)]'
                                                    : 'text-[var(--muted)] border-transparent hover:text-[var(--foreground)]'
                                                    }`}
                                            >
                                                Thinking Logs
                                            </button>
                                        </div>
                                        {run.status === 'running' && (
                                            <span className="text-xs font-mono text-blue-400 flex items-center gap-1.5">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                Live
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-6 max-h-96 overflow-y-auto">
                                        {outputTab === 'output' ? (
                                            run.logs.length === 0 ? (
                                                <p className="text-sm text-(--muted) font-mono">
                                                    {run.status === 'running' ? 'Waiting for output...' : 'No output recorded'}
                                                </p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {run.logs.map((log, i) => {
                                                        const color = log.startsWith('Error:') ? 'text-rose-500' : log.startsWith('Metadata:') ? 'text-blue-400' : 'text-[var(--muted)]';
                                                        return (
                                                            <div key={i} className={`text-xs font-mono ${color} leading-relaxed break-all flex flex-row`}>
                                                                <span className={"font-mono text-(--foreground-soft) mr-2 select-none"}>
                                                                    {String(i + 1)}
                                                                </span>
                                                                {log}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )
                                        ) : (
                                            (run as any).thinking && (run as any).thinking.length > 0 ? (
                                                <div className="space-y-1">
                                                    {(run as any).thinking.map((thought: string, i: number) => (
                                                        <div key={i} className="text-xs font-mono text-[var(--muted)] leading-relaxed break-all flex flex-row">
                                                            <span className={"font-mono text-(--foreground-soft) mr-2 select-none"}>
                                                                {String(i + 1)}
                                                            </span>
                                                            {thought}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-(--muted) font-mono">
                                                    {run.status === 'running' ? 'Waiting for thinking logs...' : 'No thinking logs recorded'}
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Faults Section */}
                                <div className="bg-[var(--surface)] rounded-xl overflow-hidden mb-8" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <div className="px-6 py-4 bg-[var(--muted-bg)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Faults</p>
                                    </div>
                                    <div className="p-6">
                                        {run.faults && run.faults.length > 0 ? (
                                            <div className="space-y-4">
                                                {run.faults.map((fault, i) => (
                                                    <div key={i} className="border-l-2 border-rose-500 pl-4">
                                                        <div className="mb-1">
                                                            <span className="text-xs font-mono text-rose-500 uppercase tracking-wider">{fault.type}</span>
                                                        </div>
                                                        <p className="text-sm font-mono text-[var(--foreground)] mb-2">{fault.message}</p>
                                                        {fault.traceback && (
                                                            <details className="text-xs font-mono text-[var(--muted)]">
                                                                <summary className="cursor-pointer hover:text-[var(--foreground)] transition-colors">View Traceback</summary>
                                                                <pre className="mt-2 bg-[var(--surface)] rounded p-2 overflow-x-auto text-xs font-mono text-[var(--muted-text)] whitespace-pre-wrap break-words">
                                                                    {fault.traceback}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[var(--muted)] font-mono">No faults detected by the agent</p>
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

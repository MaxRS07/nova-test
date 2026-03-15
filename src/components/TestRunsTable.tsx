import { useRouter } from 'next/navigation';
import { TestRun } from '@/types/nova';
import StatusBadge from './StatusBadge';

interface TestRunsTableProps {
    repositoryId: number;
    testRuns: TestRun[];
    faultCounts: Record<string, number>;
    isLoading: boolean;
    onDelete: (runId: string) => void;
    onNew: () => void;
}

export default function TestRunsTable({ repositoryId, testRuns, faultCounts, isLoading, onDelete, onNew }: TestRunsTableProps) {
    const router = useRouter();

    const cols = ['url', 'status', 'agents', 'faults detected', 'time', 'duration', ''];
    const colTemplate = 'grid-cols-[1fr_1fr_0.8fr_1fr_1fr_0.8fr_0.5fr]';

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">
                        Repository · {repositoryId}
                    </p>
                    <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Test Runs</h1>
                </div>
                <button
                    onClick={onNew}
                    className="px-4 py-2.5 rounded-lg text-sm font-mono font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                >
                    New Test
                </button>
            </div>

            <div className="bg-[var(--surface)] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className={`grid ${colTemplate} px-6 py-3 bg-[var(--muted-bg)]`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {cols.map((col) => (
                        <span key={col} className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">{col}</span>
                    ))}
                </div>

                {isLoading ? (
                    <div className="px-6 py-16 space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`grid ${colTemplate} gap-4`}>
                                {[...Array(7)].map((_, j) => (
                                    <div key={j} className="h-5 bg-[var(--muted-bg)] rounded animate-pulse" />
                                ))}
                            </div>
                        ))}
                    </div>
                ) : testRuns.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <p className="text-sm text-[var(--muted)] font-mono mb-1">No test runs yet</p>
                        <p className="text-xs text-[var(--muted)] font-mono">Click &quot;New Test&quot; to launch your first test fleet</p>
                    </div>
                ) : (
                    testRuns.map((run, i) => {
                        const faults = faultCounts[run.id] ?? 0;
                        return (
                            <div
                                key={run.id}
                                className={`grid ${colTemplate} px-6 py-4 hover:bg-[var(--muted-bg)] transition-colors items-center cursor-pointer`}
                                style={i < testRuns.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
                                onClick={() => router.push(`/repository/${repositoryId}/test/${run.id}`)}
                            >
                                <span className="font-mono text-sm text-[var(--foreground)] truncate pr-4" title={run.url}>
                                    {run.url}
                                </span>
                                <span><StatusBadge status={run.status} /></span>
                                <span className="font-mono text-sm text-[var(--foreground)]">{run.agents}</span>
                                <span className={`font-mono text-sm ${faults > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {run.status === 'running' ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                            {faults}
                                        </span>
                                    ) : faults}
                                </span>
                                <span className="font-mono text-sm text-[var(--foreground-soft)]">
                                    {new Date(run.timestamp).toLocaleString()}
                                </span>
                                <span className="font-mono text-sm text-[var(--muted)]">{run.duration}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(run.id); }}
                                    className="px-2.5 py-1 text-m font-mono rounded transition-colors text-red-500 hover:bg-red-500/10 flex justify-center align-middle place-self-center"
                                    title={run.status === 'running' ? 'Stop test run' : 'Delete test run'}
                                >
                                    {run.status === 'running' ? '■' : '✕'}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}

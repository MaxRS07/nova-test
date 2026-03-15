import { useRouter } from 'next/navigation';
import Dropdown from '@/components/Dropdown';
import InfoIcon from '@/components/InfoIcon';
import { Agent, defaultUiAgent } from '@/types/nova';

interface NewTestFormProps {
    repositoryId: number;
    testUrl: string;
    subpages: string[];
    agentCount: number;
    userAgents: Agent[];
    lastUsedAgentId?: string;
    availableAgents: Agent[];
    isLaunching: boolean;
    formErrors: Record<string, string>;
    onUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubpagesChange: (subpages: string[]) => void;
    onAgentCountChange: (count: number) => void;
    onUserAgentsChange: (agents: Agent[]) => void;
    onLaunch: () => void;
    onBack: () => void;
}

function isValidUrl(url: string) {
    try { new URL(url); return true; } catch { return false; }
}

export default function NewTestForm({
    repositoryId,
    testUrl,
    subpages,
    agentCount,
    userAgents,
    lastUsedAgentId,
    availableAgents,
    isLaunching,
    formErrors,
    onUrlChange,
    onSubpagesChange,
    onAgentCountChange,
    onUserAgentsChange,
    onLaunch,
    onBack,
}: NewTestFormProps) {
    const router = useRouter();
    const canLaunch = !isLaunching && isValidUrl(testUrl) && Object.keys(formErrors).length === 0;

    return (
        <>
            {/* Back + header */}
            <div className="mb-6">
                <button onClick={onBack} className="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block">
                    ← Back to Test Runs
                </button>
                <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
                <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight mb-1">New Test Fleet</h1>
                <p className="text-sm text-[var(--muted)] font-mono">Configure and launch your agent-powered test execution</p>
            </div>

            {/* Config card */}
            <div className="bg-[var(--surface)] rounded-xl p-6 mb-6" style={{ border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-6">Agent Configuration</p>

                {/* User Agents */}
                <div className="mb-6">
                    <span className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">
                        User Agents
                        <InfoIcon text="Select user agents to simulate different browsers and devices during test execution." />
                    </span>
                    <div className="space-y-3">
                        {userAgents.map((agent, i) => (
                            <div key={i} className="flex gap-3 items-center">
                                <div className="flex-1">
                                    <Dropdown
                                        options={availableAgents.map(a => ({ value: a.id, label: a.name }))}
                                        value={agent.id}
                                        onChange={(value) => {
                                            const updated = [...userAgents];
                                            const selectedAgent = availableAgents.find(a => a.id === value);
                                            if (selectedAgent) {
                                                updated[i] = { ...selectedAgent };
                                                onUserAgentsChange(updated);
                                            }
                                        }}
                                        onCreate={() => router.push(`/repository/${repositoryId}/agents/new`)}
                                        lastUsedValue={lastUsedAgentId}
                                    />
                                </div>
                                {userAgents.length > 1 && (
                                    <button
                                        onClick={() => onUserAgentsChange(userAgents.filter((_, idx) => idx !== i))}
                                        className="px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-[var(--border-subtle)]"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        <button
                            type="button"
                            onClick={() => userAgents.length < 5 && availableAgents.length > 0 && onUserAgentsChange([...userAgents, availableAgents[0]])}
                            disabled={userAgents.length >= 5 || availableAgents.length === 0}
                            className="px-3 py-2 text-xs font-mono text-[var(--accent)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors border border-[var(--border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + Add Agent
                        </button>
                        <span className="text-xs text-[var(--muted)] font-mono">{userAgents.length}/5</span>
                    </div>
                </div>

                {/* Parallel Agents slider */}
                <div className="mb-6">
                    <label className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">Parallel Agents</label>
                    <div className="flex items-center gap-4">
                        <input
                            type="range" min="1" max="8"
                            value={agentCount}
                            onChange={(e) => onAgentCountChange(parseInt(e.target.value))}
                            className="flex-1 h-2 rounded-full bg-[var(--muted-bg)] outline-none"
                        />
                        <div className="w-16 bg-[var(--muted-bg)] rounded-lg px-4 py-2 text-center">
                            <span className="font-mono font-bold text-[var(--foreground)]">{agentCount}</span>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] font-mono mt-2">Higher count = faster parallel execution</p>
                </div>

                {/* Test URL */}
                <div>
                    <label className="block text-sm font-mono text-[var(--foreground-soft)] mb-3">
                        <span className="flex items-center gap-2">
                            Test URL
                            <InfoIcon text="URL of your application to test. The fleet will spawn here and on sub-pages." />
                        </span>
                    </label>
                    <input
                        type="text"
                        value={testUrl}
                        onChange={onUrlChange}
                        placeholder="https://myapp.com"
                        className={`w-full p-3 rounded-lg border transition-all font-mono text-sm bg-[var(--background)] ${formErrors['testUrl'] ? 'border-rose-500 focus:outline-none' : 'border-[var(--border-subtle)]'
                            }`}
                    />
                    {formErrors['testUrl'] && (
                        <p className="text-xs text-rose-500 font-mono mt-2">{formErrors['testUrl']}</p>
                    )}

                    {/* Subpages */}
                    {subpages.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-xs text-[var(--muted)] font-mono">Subpages</p>
                            {subpages.map((subpage, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <span className="text-[var(--muted)] text-sm font-mono">/</span>
                                    <input
                                        type="text"
                                        value={subpage}
                                        onChange={(e) => {
                                            const updated = [...subpages];
                                            updated[index] = e.target.value;
                                            onSubpagesChange(updated);
                                        }}
                                        placeholder="dashboard"
                                        className="flex-1 p-3 rounded-lg border border-[var(--border-subtle)] font-mono text-sm bg-[var(--background)]"
                                    />
                                    <button
                                        onClick={() => onSubpagesChange(subpages.filter((_, i) => i !== index))}
                                        className="px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => onSubpagesChange([...subpages, ''])}
                        className="mt-3 px-3 py-2 text-xs font-mono text-[var(--accent)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors border border-[var(--border-subtle)]"
                    >
                        + Add Subpage
                    </button>
                </div>
            </div>

            {/* Launch button */}
            <button
                onClick={onLaunch}
                disabled={!canLaunch}
                className={`w-full py-3 rounded-lg font-semibold transition-all border flex items-center justify-center gap-2 ${canLaunch
                    ? 'text-white border-[var(--muted)] hover:shadow-lg cursor-pointer'
                    : 'text-[var(--muted)] cursor-not-allowed border-[var(--border)]'
                    }`}
            >
                {isLaunching && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isLaunching ? 'Launching...' : 'Launch Test Fleet'}
            </button>
        </>
    );
}

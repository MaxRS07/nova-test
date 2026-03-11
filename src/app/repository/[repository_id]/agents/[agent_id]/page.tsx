'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import MarkdownEditor from '@/components/MarkdownEditor';
import InfoIcon from '@/components/InfoIcon';
import { Agent } from '@/types/nova';

export default function AgentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const repositoryId = params.repository_id as string;
    const agentId = params.agent_id as string;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [actions, setActions] = useState<string[]>([]);
    const [context, setContext] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [topP, setTopP] = useState(0.9);
    const [maxTokens, setMaxTokens] = useState(2048);
    const [selectedTools, setSelectedTools] = useState<string[]>([]);

    const availableTools = [
        'web_search',
        'code_execution',
        'file_reader',
        'api_caller',
        'database_query',
        'email_sender',
    ];

    useEffect(() => {
        try {
            const agentsJson = localStorage.getItem('nova-agents');
            if (agentsJson) {
                const agents: Agent[] = JSON.parse(agentsJson);
                const foundAgent = agents.find(a => a.id === agentId);
                if (foundAgent) {
                    setAgent(foundAgent);
                    setName(foundAgent.name);
                    setActions(foundAgent.actions);
                    setContext(foundAgent.context);
                    setTemperature(foundAgent.config.temperature);
                    setTopP(foundAgent.config.topP);
                    setMaxTokens(foundAgent.config.maxTokens);
                    setSelectedTools(foundAgent.selectedTools);
                } else {
                    setErrorMessage('Agent not found');
                }
            } else {
                setErrorMessage('No agents found');
            }
        } catch (error) {
            console.error('Failed to load agent:', error);
            setErrorMessage('Failed to load agent');
        } finally {
            setIsLoading(false);
        }
    }, [agentId]);

    const handleAddAction = () => {
        setActions([...actions, '']);
    };

    const handleRemoveAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index));
    };

    const handleUpdateAction = (index: number, value: string) => {
        const updatedActions = [...actions];
        updatedActions[index] = value;
        setActions(updatedActions);
    };

    const toggleTool = (tool: string) => {
        setSelectedTools(prev =>
            prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
        );
    };

    const handleSave = async () => {
        setErrorMessage(null);
        setSuccessMessage(null);
        setIsSaving(true);

        try {
            if (!name.trim()) {
                throw new Error('Agent name is required');
            }
            if (actions.filter(a => a.trim()).length === 0) {
                throw new Error('At least one action is required');
            }

            // Load all agents
            const agentsJson = localStorage.getItem('nova-agents');
            const allAgents: Agent[] = agentsJson ? JSON.parse(agentsJson) : [];

            // Update the agent
            const updatedAgents = allAgents.map(a => {
                if (a.id === agentId) {
                    return {
                        ...a,
                        name: name.trim(),
                        actions: actions.filter(a => a.trim()),
                        context: context.trim(),
                        config: {
                            temperature,
                            topP,
                            maxTokens,
                        },
                        selectedTools,
                    };
                }
                return a;
            });

            localStorage.setItem('nova-agents', JSON.stringify(updatedAgents));
            setSuccessMessage('Agent updated successfully!');

            setTimeout(() => {
                router.push(`/repository/${repositoryId}/agents`);
            }, 1000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save agent';
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this agent?')) {
            try {
                const agentsJson = localStorage.getItem('nova-agents');
                const allAgents: Agent[] = agentsJson ? JSON.parse(agentsJson) : [];
                const filteredAgents = allAgents.filter(a => a.id !== agentId);
                localStorage.setItem('nova-agents', JSON.stringify(filteredAgents));
                router.push(`/repository/${repositoryId}/agents`);
            } catch (error) {
                setErrorMessage('Failed to delete agent');
            }
        }
    };

    const inputClass = 'w-full px-4 py-3 text-sm font-mono rounded-lg bg-[var(--muted-bg)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all';
    const labelClass = 'flex items-center text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider mb-2.5';

    if (isLoading) {
        return (
            <div className="flex h-screen bg-[var(--background)]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Topbar />
                    <main className="flex-1 flex items-center justify-center">
                        <p className="text-[var(--muted)] font-mono">Loading agent...</p>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[var(--background)]">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Topbar />

                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-10 py-12">
                        {/* Header */}
                        <div className="mb-10">
                            <button
                                onClick={() => router.push(`/repository/${repositoryId}/agents`)}
                                className="text-xs font-mono text-[var(--accent)] hover:underline mb-4 inline-block"
                            >
                                ← Back to Agents
                            </button>
                            <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Edit Agent</h1>
                        </div>

                        {/* Error message */}
                        {errorMessage && (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mb-6">
                                <p className="text-sm font-mono text-rose-500">{errorMessage}</p>
                            </div>
                        )}

                        {/* Success message */}
                        {successMessage && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6">
                                <p className="text-sm font-mono text-emerald-500">{successMessage}</p>
                            </div>
                        )}

                        <form className="space-y-8">
                            {/* Name */}
                            <div>
                                <label className={labelClass}>
                                    Name <InfoIcon text="A unique identifier for your agent." />
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputClass}
                                />
                            </div>

                            {/* Actions */}
                            <div>
                                <label className={labelClass}>
                                    Actions <InfoIcon text="Define actions your agent can perform." />
                                </label>
                                <div className="space-y-3">
                                    {actions.map((action, i) => (
                                        <div key={i} className="flex gap-3">
                                            <input
                                                type="text"
                                                value={action}
                                                onChange={(e) => handleUpdateAction(i, e.target.value)}
                                                placeholder={i === 0 ? 'What should the agent do?' : `Action ${i + 1}`}
                                                className={inputClass}
                                            />
                                            {actions.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAction(i)}
                                                    className="px-4 py-3 text-sm font-mono text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                >
                                                    rm
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddAction}
                                    className="mt-3 text-sm font-mono text-[var(--accent)] hover:opacity-80 transition-opacity"
                                >
                                    + add action
                                </button>
                            </div>

                            {/* Context */}
                            <div>
                                <label className={labelClass}>
                                    Context <InfoIcon text="Instructions and guidelines for the agent." />
                                </label>
                                <MarkdownEditor
                                    value={context}
                                    onChange={setContext}
                                    placeholder="Add context and instructions for the agent..."
                                    rows={8}
                                />
                            </div>

                            {/* Configuration */}
                            <div className="bg-[var(--surface)] rounded-xl p-6" style={{ border: '1px solid var(--border-subtle)' }}>
                                <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-6">Configuration</p>

                                {/* Temperature */}
                                <div className="mb-6">
                                    <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
                                        Temperature: <span className="text-[var(--foreground)]">{temperature.toFixed(2)}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-[var(--muted-bg)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1.5">Controls randomness. 0 = deterministic, 2 = very random</p>
                                </div>

                                {/* Top-P */}
                                <div className="mb-6">
                                    <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
                                        Top-P: <span className="text-[var(--foreground)]">{topP.toFixed(2)}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={topP}
                                        onChange={(e) => setTopP(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-[var(--muted-bg)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1.5">Nucleus sampling. Controls diversity of outputs</p>
                                </div>

                                {/* Max Tokens */}
                                <div className="mb-6">
                                    <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
                                        Max Tokens: <span className="text-[var(--foreground)]">{maxTokens}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="256"
                                        max="4096"
                                        step="256"
                                        value={maxTokens}
                                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                        className="w-full h-2 bg-[var(--muted-bg)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1.5">Maximum response length in tokens</p>
                                </div>

                                {/* Tools Section */}
                                <div className="pt-4 border-t border-[var(--border)]">
                                    <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-3">
                                        Tools
                                    </label>
                                    <div className="space-y-2">
                                        {availableTools.map((tool) => (
                                            <label key={tool} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--muted-bg)] p-2 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTools.includes(tool)}
                                                    onChange={() => toggleTool(tool)}
                                                    className="app-checkbox"
                                                />
                                                <span className="text-sm font-mono text-[var(--foreground-soft)]">{tool}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Save and Delete buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-6 py-3 text-sm font-mono rounded-lg transition-opacity ${isSaving
                                        ? 'bg-[var(--muted)] text-[var(--muted-text)] cursor-not-allowed opacity-50'
                                        : 'bg-[var(--accent)] text-white hover:opacity-90'
                                        }`}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-6 py-3 text-sm font-mono text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/30"
                                >
                                    Delete Agent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push(`/repository/${repositoryId}/agents`)}
                                    className="px-6 py-3 text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground-soft)] hover:bg-[var(--muted-bg)] rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}

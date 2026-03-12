'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { Agent } from '@/types/nova';
import { useState, useEffect } from 'react';
import { getAgents, deleteAgent } from '@/lib/supabase';

export default function AgentsPage() {
    const params = useParams();
    const router = useRouter();
    const repositoryId = Number(params.repository_id);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load agents from database on mount
    useEffect(() => {
        const loadAgents = async () => {
            try {
                const loadedAgents = await getAgents(repositoryId);
                setAgents(loadedAgents);
            } catch (error) {
                console.error('Failed to load agents:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (repositoryId) {
            loadAgents();
        }
    }, [repositoryId]);

    const handleRemove = async (id: string) => {
        try {
            await deleteAgent(id);
            setAgents(agents.filter(agent => agent.id !== id));
        } catch (error) {
            console.error('Failed to delete agent:', error);
        }
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <Topbar />

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />

                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-6xl mx-auto px-10 py-12">
                        {/* Header */}
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-mono text-(--muted) uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
                                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Agents</h1>
                            </div>
                            <Link
                                href={`/repository/${repositoryId}/agents/new`}
                                className="px-4 py-2 bg-(--accent) rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                            >
                                Create Agent
                            </Link>
                        </div>

                        {/* Agents Table */}
                        <div className="bg-(--surface) rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b" style={{ borderColor: 'var(--muted-bg)' }}>
                                            <th className="px-6 py-4 text-left text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-4 text-left text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Actions</th>
                                            <th className="px-6 py-4 text-left text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agents.map((agent) => (
                                            <tr
                                                key={agent.id}
                                                onClick={() => router.push(`/repository/${repositoryId}/agents/${agent.id}`)}
                                                className="hover:bg-[var(--muted-bg)] transition-colors border-t border-[var(--muted-bg)] cursor-pointer"
                                                style={{ borderColor: 'var(--muted-bg)' }}
                                            >
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-[var(--foreground)]">{agent.name}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-[var(--muted)]">{agent.actions.join(', ').slice(0, 50)}{agent.actions.join(', ').length > 50 ? '...' : ''}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-mono text-[var(--muted)]">{new Date(agent.created).toLocaleDateString()}</p>
                                                </td>
                                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => handleRemove(agent.id)} className="opacity-10 transition-all hover:opacity-100 hover:text-rose-500 text-sm font-medium">
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Empty state (if needed later) */}
                        {agents.length === 0 && !isLoading && (
                            <div className="text-center py-16">
                                <p className="text-[var(--muted)] mb-4 font-mono">No agents created yet</p>
                                <Link
                                    href={`/repository/${repositoryId}/agents/new`}
                                    className="text-[var(--accent)] hover:underline text-sm font-medium"
                                >
                                    Create your first agent
                                </Link>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
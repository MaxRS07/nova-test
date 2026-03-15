'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useProjects } from '@/contexts/ProjectsContext';
import { useParams } from 'next/navigation';

export default function RepositorySettings() {
    const params = useParams();
    const repositoryId = params.repository_id;
    const project = useProjects().getProject(Number(repositoryId));
    const [autoApproveActions, setAutoApproveActions] = useState(false);
    const [blacklistedDomains, setBlacklistedDomains] = useState<string[]>([]);

    if (!project) {
        return (
            <div className="flex flex-col h-screen bg-[var(--background)]">
                <Topbar />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-[var(--muted)] font-mono">Repository not found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[var(--background)]">
            <Topbar />

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />

                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-10 py-12">

                        {/* Header */}
                        <div className="mb-8">
                            <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
                            <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Settings</h1>
                        </div>

                        {/* Settings Section */}
                        <div className="space-y-6">
                            {/* Auto Approve Actions Setting */}
                            <div className="bg-[var(--surface)] rounded-xl px-6 py-5" style={{ border: '1px solid var(--border-subtle)' }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className='justify-between flex flex-row'>
                                            <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">Automatically approve model actions</h3>
                                        </div>
                                        <p className="text-xs text-[var(--muted)] font-mono">Allow Act agents to execute actions without requiring manual approval</p>
                                    </div>
                                    <label className="relative inline-block w-12 h-6 ml-4">
                                        <input
                                            type="checkbox"
                                            checked={autoApproveActions}
                                            onChange={(e) => setAutoApproveActions(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div
                                            className={`block w-full h-full rounded-full transition-colors cursor-pointer ${autoApproveActions ? 'bg-[var(--accent)]' : 'bg-[var(--muted-bg)]'}`}
                                        />
                                        <div
                                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoApproveActions ? 'translate-x-6' : 'translate-x-0'
                                                }`}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Guardrails Section */}
                            <div>
                                <div className="mb-4">
                                    <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">Guardrails</h2>
                                    <p className="text-xs text-[var(--muted)] font-mono mt-1">Configure safety constraints and restrictions for agent behavior</p>
                                </div>

                                {/* Blacklisted Domains */}
                                <div className="bg-[var(--surface)] rounded-xl px-6 py-5" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">Blacklisted Domains</h3>
                                    <p className="text-xs text-[var(--muted)] font-mono mb-4">Prevent agents from navigating to these domains</p>

                                    <div className="space-y-3">
                                        {blacklistedDomains.length === 0 ? (
                                            <p className="text-sm text-[var(--muted)] font-mono py-4">No blacklisted domains yet</p>
                                        ) : (
                                            blacklistedDomains.map((domain, index) => (
                                                <div key={index} className="flex gap-3 items-center">
                                                    <input
                                                        type="text"
                                                        value={domain}
                                                        onChange={(e) => {
                                                            const updated = [...blacklistedDomains];
                                                            updated[index] = e.target.value;
                                                            setBlacklistedDomains(updated);
                                                        }}
                                                        placeholder="example.com"
                                                        className="flex-1 p-3 rounded-lg border border-[var(--border-subtle)] transition-all text-left font-mono text-sm bg-[var(--background)]"
                                                    />
                                                    <button
                                                        onClick={() => setBlacklistedDomains(blacklistedDomains.filter((_, i) => i !== index))}
                                                        className="px-3 py-2 text-xs font-mono text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <button
                                        type='button'
                                        onClick={() => setBlacklistedDomains(prev => [...prev, ''])}
                                        className="mt-3 px-3 py-2 text-xs font-mono text-[var(--accent)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors border border-[var(--border-subtle)]"
                                    >
                                        + Add Domain
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}

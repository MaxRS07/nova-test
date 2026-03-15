'use client';

import Link from 'next/link';
import UserMenu from './UserMenu';
import WebCLI from './WebCLI';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useProjects } from '@/contexts/ProjectsContext';

export default function Topbar() {
    const { user, loading } = useAuth();
    const params = useParams();
    const [webCLIOpen, setWebCLIOpen] = useState(false);

    const repositoryId = params.repository_id ? Number(params.repository_id) : null;
    var project = null;
    if (repositoryId) {
        project = useProjects().getProject(repositoryId);
    }
    const toggleWebCLI = () => {
        setWebCLIOpen(!webCLIOpen);
    };
    return (
        <header className="h-14 flex items-center justify-between px-6 bg-[var(--surface)] shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className='flex flex-row'>
                <Link href="/" className="font-mono text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors tracking-tight">
                    nova-test
                </Link>
                {params.repository_id && (
                    <>
                        <span className="mx-2 text-[var(--muted)]">/</span>
                        <Link href={`/repository/${params.repository_id}/dashboard`} className="font-mono text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors tracking-tight">
                            {project ? project.name : `repo-${params.repository_id}`}
                        </Link>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={toggleWebCLI}
                    title="Open Web CLI"
                    className="text-[var(--muted)] hover:text-[var(--foreground-soft)] transition-colors text-xs font-mono tracking-wide"
                >
                    terminal
                </button>
                <UserMenu
                    user={user}
                    loading={loading}
                />
            </div>

            <WebCLI isOpen={webCLIOpen} onClose={() => setWebCLIOpen(false)} />
        </header>
    );
}

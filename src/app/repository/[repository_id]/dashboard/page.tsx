'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useProjects } from '@/contexts/ProjectsContext';
import { useParams } from 'next/navigation';

export default function RepositoryDashboard() {
  const params = useParams();
  const repositoryId = Number(params.repository_id);
  const project = useProjects().getProject(repositoryId);

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
          <div className="max-w-5xl mx-auto px-10 py-12">

            {/* Header */}
            <div className="mb-10">
              <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Repository · {repositoryId}</p>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">{project?.name}</h1>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

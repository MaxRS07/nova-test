'use client';

import Topbar from '@/components/Topbar';
import RepositoryConnectCard from '@/components/RepositoryConnectCard';
import { useProjects } from '@/contexts/ProjectsContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveProject, deleteProject } from '@/lib/supabase';

export default function Home() {
  const { projects, addProject, removeProject } = useProjects();
  const [connectPageOpen, setConnectPageOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleDeleteRepository = async (repoId: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteProject(repoId);
      removeProject(repoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRepository = async (repo: any) => {
    setLoading(true);
    setError(null);
    try {
      const repoId = typeof repo.id === 'string' ? parseInt(repo.id, 10) : repo.id;
      const savedProject = await saveProject({ ...repo, id: repoId });
      addProject(repo);
      setConnectPageOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      <Topbar />

      <RepositoryConnectCard
        isOpen={connectPageOpen}
        onClose={() => setConnectPageOpen(false)}
        onConnect={handleConnectRepository}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-10 py-12">

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
              <p className="text-sm text-rose-500 font-mono">{error}</p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Workspace</p>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Projects</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)] font-mono">{Object.keys(projects).length} connected</span>
              <button
                onClick={() => setConnectPageOpen(true)}
                disabled={loading}
                className="px-4 py-2 text-sm font-mono bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Connect
              </button>
            </div>
          </div>

          {/* Repository Table */}
          <div className="bg-[var(--surface)] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr] px-6 py-3.5 bg-[var(--muted-bg)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['name', 'url', 'tests', 'status', ''].map((col) => (
                <span key={col} className="text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider">{col}</span>
              ))}
            </div>

            {/* Rows */}
            {Object.keys(projects).length === 0 ? (
              <div className="px-6 py-20 text-center">
                <p className="text-[var(--muted)] font-mono text-sm mb-2">No projects yet</p>
                <button
                  onClick={() => setConnectPageOpen(true)}
                  disabled={loading}
                  className="text-[var(--accent)] text-sm font-mono hover:underline disabled:opacity-50"
                >
                  + connect one
                </button>
              </div>
            ) : (
              Object.values(projects).map((proj, i) => (
                <div
                  key={proj.id}
                  className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr] px-6 py-5 group hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
                  style={i < Object.keys(projects).length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
                  onClick={() => !loading && router.push(`/repository/${proj.id}/dashboard`)}
                >
                  <span className="font-mono text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                    {proj.name}
                  </span>
                  <span className="font-mono text-sm text-[var(--muted)] truncate pr-4">{proj.url}</span>
                  <div
                    className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => router.push(`/repository/${proj.id}/dashboard`)}
                      disabled={loading}
                      className="text-xs font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                    >
                      view
                    </button>
                    <button
                      onClick={() => handleDeleteRepository(proj.id)}
                      disabled={loading}
                      className="text-xs font-mono text-[var(--muted)] hover:text-rose-500 transition-colors disabled:opacity-50"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer links */}
          <div className="mt-8 flex items-center gap-5 text-sm font-mono text-[var(--muted)]">
            <button className="hover:text-[var(--foreground-soft)] transition-colors">view reports</button>
            <span className="text-[var(--border)]">·</span>
            <button className="hover:text-[var(--foreground-soft)] transition-colors">docs</button>
          </div>
        </div>
      </main>
    </div>
  );
}

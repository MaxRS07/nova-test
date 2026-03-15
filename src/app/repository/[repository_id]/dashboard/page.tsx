'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { useProjects } from '@/contexts/ProjectsContext';
import { useParams } from 'next/navigation';
import { getAgents, getTestRuns, getFaultCounts } from '@/lib/supabase';
import { Agent, TestRun } from '@/types/nova';

export default function RepositoryDashboard() {
  const params = useParams();
  const repositoryId = Number(params.repository_id);
  const project = useProjects().getProject(repositoryId);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [faultCounts, setFaultCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!repositoryId) return;
    (async () => {
      try {
        setIsLoading(true);
        const [agentsData, runsData, faults] = await Promise.all([
          getAgents(repositoryId),
          getTestRuns(repositoryId),
          getFaultCounts(repositoryId),
        ]);
        setAgents(agentsData);
        setTestRuns(runsData);
        setFaultCounts(faults);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [repositoryId]);

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

            {/* Overview Panels */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] animate-pulse">
                  <div className="h-4 bg-[var(--muted-bg)] rounded w-24 mb-3"></div>
                  <div className="h-8 bg-[var(--muted-bg)] rounded w-12"></div>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] animate-pulse">
                  <div className="h-4 bg-[var(--muted-bg)] rounded w-24 mb-3"></div>
                  <div className="h-8 bg-[var(--muted-bg)] rounded w-12"></div>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] animate-pulse">
                  <div className="h-4 bg-[var(--muted-bg)] rounded w-24 mb-3"></div>
                  <div className="h-8 bg-[var(--muted-bg)] rounded w-12"></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Agents Panel */}
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">Agents</p>
                      <p className="text-3xl font-bold text-[var(--foreground)]">{agents.length}</p>
                      <p className="text-xs text-[var(--muted)] font-mono mt-2">Active test agents</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-lg">🤖</span>
                    </div>
                  </div>
                </div>

                {/* Test Runs Panel */}
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">Test Runs</p>
                      <p className="text-3xl font-bold text-[var(--foreground)]">{testRuns.length}</p>
                      <div className="text-xs text-[var(--muted)] font-mono mt-2 space-y-1">
                        <div>{testRuns.filter(r => r.status === 'running').length} running</div>
                        <div>{testRuns.filter(r => r.status === 'completed').length} completed</div>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-lg">▶</span>
                    </div>
                  </div>
                </div>

                {/* Faults Panel */}
                <div className="bg-[var(--surface)] rounded-lg p-6 border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">Total Faults</p>
                      <p className="text-3xl font-bold text-[var(--foreground)]">{Object.values(faultCounts).reduce((a, b) => a + b, 0)}</p>
                      <p className="text-xs text-[var(--muted)] font-mono mt-2">Found across all runs</p>
                    </div>
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-lg">⚠</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Test Runs */}
            {!isLoading && testRuns.length > 0 && (
              <div className="bg-[var(--surface)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
                  <h2 className="text-sm font-semibold text-[var(--foreground)] font-mono">Recent Test Runs</h2>
                </div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {testRuns.slice(0, 5).map(run => (
                    <div key={run.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--background)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-[var(--foreground)] truncate">{run.url}</p>
                        <p className="text-xs text-[var(--muted)] font-mono mt-1">{run.timestamp}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-[var(--muted)] font-mono">{faultCounts[run.id] ?? 0} faults</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-mono font-semibold ${run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                          }`}>
                          {run.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

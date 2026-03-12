'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import MarkdownEditor from '@/components/MarkdownEditor';
import Link from 'next/link';
import InfoIcon from '@/components/InfoIcon';
import { Agent } from '@/types/nova';
import { saveAgent } from '@/lib/supabase';

export default function NewAgentPage() {
  const router = useRouter();
  const params = useParams();
  const repositoryId = Number(params.repository_id);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [actions, setActions] = useState(['']);
  const [context, setContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableTools = [
    'web_search',
    'code_execution',
    'file_reader',
    'api_caller',
    'database_query',
    'email_sender',
  ];

  const addAction = () => setActions([...actions, '']);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, v: string) => {
    const a = [...actions];
    a[i] = v;
    setActions(a);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const allowed = ['.pdf', '.txt', '.md', '.json', '.csv', '.doc', '.docx'];
    setFiles([
      ...files,
      ...Array.from(e.target.files).filter((f) =>
        allowed.some((ext) => f.name.endsWith(ext))
      ),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Validate form
      if (!name.trim()) {
        throw new Error('Agent name is required');
      }
      if (actions.filter((a) => a.trim()).length === 0) {
        throw new Error('At least one action is required');
      }

      // Create agent object
      const agent: Agent = {
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        repo_id: repositoryId,
        name: name.trim(),
        actions: actions.filter((a) => a.trim()),
        context: context.trim(),
        fileNames: files.map((f) => f.name),
        config: {
          temperature,
          topP,
          maxTokens,
        },
        selectedTools,
        created: new Date().toISOString(),
      };

      // Save to database
      await saveAgent(agent);

      // Redirect to agents page
      router.push(`/repository/${repositoryId}/agents`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create agent';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 text-sm font-mono rounded-lg bg-[var(--muted-bg)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all';
  const labelClass = 'flex items-center text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider mb-2.5';

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-10 py-12">

            <div className="mb-10">
              <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-2">Agents</p>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">New Agent</h1>
              <p className="text-sm text-[var(--muted)] font-mono mt-1.5">Configure a new agent with actions and context</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Error message */}
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                  <p className="text-sm font-mono text-rose-500">{errorMessage}</p>
                </div>
              )}
              {/* Name */}
              <div>
                <label className={labelClass}>
                  Name <InfoIcon text="A unique identifier for your model, shown in the model list." />
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-model" className={inputClass} required />
              </div>

              {/* Actions */}
              <div>
                <label className={labelClass}>
                  Actions <InfoIcon text="Define actions your model can perform. Be direct and concise." />
                </label>
                <div className="space-y-3">
                  {actions.map((action, i) => (
                    <div key={i} className="flex gap-3">
                      <input
                        type="text"
                        value={action}
                        onChange={(e) => updateAction(i, e.target.value)}
                        placeholder={i === 0 ? 'What should the agent do?' : `Action ${i + 1}`}
                        className={inputClass}
                      />
                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(i)}
                          className="px-4 py-3 text-sm font-mono text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          rm
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addAction} className="mt-3 text-sm font-mono text-[var(--accent)] hover:opacity-80 transition-opacity">
                  + add action
                </button>
              </div>

              {/* Context */}
              <div>
                <label className={labelClass}>
                  Context <InfoIcon text="Instructions and guidelines that guide the model's behavior. Supports markdown syntax." />
                </label>
                <MarkdownEditor
                  value={context}
                  onChange={setContext}
                  placeholder="Add context and instructions for the model..."
                  rows={8}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className={labelClass}>
                  Files <InfoIcon text="Upload PDFs, markdown, or CSVs for the model to reference." />
                </label>
                <div className="relative rounded-lg p-8 hover:bg-[var(--muted-bg)] transition-colors cursor-pointer text-center" style={{ border: '1.5px dashed var(--border)' }}>
                  <input
                    type="file" multiple accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <p className="text-sm font-mono text-[var(--muted)]">click or drag files here</p>
                  <p className="text-xs font-mono text-[var(--muted)] mt-1 opacity-60">pdf · txt · md · json · csv · doc</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--muted-bg)]">
                        <span className="text-sm font-mono text-[var(--foreground-soft)]">{file.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-[var(--muted)]">{(file.size / 1024).toFixed(1)} kb</span>
                          <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-xs font-mono text-rose-500 hover:opacity-70 transition-opacity">rm</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional parameters dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-sm font-mono text-[var(--accent)] hover:opacity-80 transition-opacity"
                >
                  Config {showConfig ? '−' : '+'}
                </button>

                {showConfig && (
                  <div className="absolute top-8 left-0 w-full bg-[var(--surface)] rounded-lg shadow-lg p-6 z-20 space-y-6" style={{ border: '1px solid var(--border)' }}>
                    {/* Temperature */}
                    <div>
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
                    <div>
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
                    <div>
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
                    <button onClick={(e) => { e.preventDefault(); setTemperature(0.7); setTopP(0.9); setMaxTokens(2048); setSelectedTools([]); }}>
                      Reset to defaults
                    </button>
                  </div>
                )}
              </div>
              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-3 text-sm font-mono rounded-lg transition-opacity ${isSubmitting
                    ? 'bg-[var(--muted)] text-[var(--muted-text)] cursor-not-allowed opacity-50'
                    : 'bg-[var(--accent)] text-white hover:opacity-90'
                    }`}
                >
                  {isSubmitting ? 'Creating...' : 'Create Agent'}
                </button>
                <Link
                  href={`/repository/${repositoryId}/agents`}
                  className="px-6 py-3 text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground-soft)] hover:bg-[var(--muted-bg)] rounded-lg transition-all"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

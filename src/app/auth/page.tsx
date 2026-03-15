'use client';

import { useState, useEffect } from 'react';
import { useSystemTheme } from '@/hooks/useSystemTheme';

export default function AuthPage() {
    const [loading, setLoading] = useState(false);
    const isDark = useSystemTheme();

    useEffect(() => {
        // Apply system theme to html element
        if (isDark !== null) {
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        }
    }, [isDark]);

    const handleGitHubLogin = async () => {
        setLoading(true);
        window.location.href = "/api/auth/github?action=login";
    };

    return (
        <div className="min-h-screen flex bg-[var(--background)]">

            {/* Left — Login panel */}
            <div className="w-96 shrink-0 flex flex-col bg-[var(--surface)] px-10 py-14" style={{ borderRight: '1px solid var(--border)' }}>

                {/* Wordmark */}
                <div className="mb-16">
                    <p className="font-mono text-sm font-semibold text-[var(--foreground)] tracking-tight">nova-test</p>
                </div>

                {/* Header */}
                <div className="mb-10">
                    <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest mb-3">Welcome</p>
                    <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight mb-2">Sign in</h1>
                    <p className="text-sm text-[var(--muted)] font-mono leading-relaxed">
                        Connect your GitHub account to get started with agentic workflows.
                    </p>
                </div>

                {/* GitHub Button */}
                <button
                    onClick={handleGitHubLogin}
                    disabled={loading}
                    className="flex items-center gap-3 px-5 py-3.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-mono font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.546 2.91 1.185.092-.923.35-1.546.636-1.903-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.817c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.191 20 14.44 20 10.017 20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                    </svg>
                    <span>{loading ? 'Signing in...' : 'Sign in with GitHub'}</span>
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Footer */}
                <p className="text-xs font-mono text-[var(--muted)] leading-relaxed">
                    By continuing, you agree to our{' '}
                    <span className="text-[var(--foreground-soft)] hover:underline cursor-pointer">Terms of Service</span>
                    {' '}and{' '}
                    <span className="text-[var(--foreground-soft)] hover:underline cursor-pointer">Privacy Policy</span>.
                </p>
            </div>

            {/* Right — Graphics placeholder */}
            <div className="flex-1 flex items-center justify-center">
                <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-widest">graphics coming soon</p>
            </div>

        </div>
    );
}

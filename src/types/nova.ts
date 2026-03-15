/**
 * Nova Flow API Types
 * Types for browser automation, interactions, and file operations
 */

export type ActMetadata = {
    session_id: string;
    act_id: string;
    num_steps_executed: number;
    start_time: number | null;
    end_time: number | null;
    prompt: string;
    step_server_times_s: number[];
    time_worked_s: number | null;
    human_wait_time_s: number;
}

export type ActRequestBody = {
    session_id: string;
    url: string;
    pages: string[];
    auto_approve_inputs?: boolean;
    agent_config: Agent[];
}

export type TestRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type TestRun = {
    id: string;
    repo_id: number;
    url: string;
    pages: string[];
    config: string;
    agents: number;
    userAgents: string[];
    status: TestRunStatus;
    timestamp: string;
    duration: string;
}

export type TestRunEventType = 'metadata' | 'fault' | 'thinking';

export type TestRunEvent = {
    id: string;
    run_id: string;
    type: TestRunEventType;
    data: string;       // text column — JSON-encoded string from the server
    created_at: string;
}

export type Fault = {
    message: string;
    type: string;
    traceback: string;
}

export interface Agent {
    id: string;
    repo_id?: number;
    name: string;
    actions: string[];
    context: string;
    fileNames: string[];
    config: {
        temperature: number;
        topP: number;
        maxTokens: number;
    };
    selectedTools: string[];
    created?: string;
}

export interface Project {
    repo_id: number;
    url?: string;
    user_id?: string;
    created_at?: string;
}

export const defaultUiAgent: Agent = {
    id: "default-ui-agent",
    name: "Default UI Agent",
    actions: [
        'navigate to different pages on the site and report visual errors with the user interface',
    ],
    context: "",
    fileNames: [],
    config: {
        temperature: .7,
        topP: 0,
        maxTokens: 0
    },
    selectedTools: [],
};

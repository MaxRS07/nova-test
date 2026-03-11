/**
 * Nova Flow API Types
 * Types for browser automation, interactions, and file operations
 */

/**
 * Common request/response types
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

export type TestRunStatus = 'running' | 'completed' | 'failed';

export type TestRun = {
    id: string;
    url: string;
    pages: string[];
    config: string;
    agents: number;
    userAgents: string[];
    status: TestRunStatus;
    timestamp: string;
    faults: number;
    duration: string;
    logs: string[];
}
export interface Agent {
    id: string;
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
    created: string;
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
    created: "--:--"
};
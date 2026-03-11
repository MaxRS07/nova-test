import { ActMetadata, ActRequestBody } from "@/types/nova";

export async function startNovaActJob(data: ActRequestBody): Promise<ActSocket> {
    try {
        const response = await fetch("/api/aws", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const resData = await response.json();

        if (response.ok && resData.data && resData.data.run_id) {
            const { data } = resData;
            const socket = new ActSocket(data.run_id);
            return socket;
        } else {
            throw new Error(resData.error || "Failed to start Nova Act job");
        }
    } catch (error) {
        console.error("Error starting Nova Act job:", error);
        throw error;
    }
}

class ActSocket {
    private socket: WebSocket;

    public act_started: boolean = false;

    private run_id: string;

    // Public callbacks for UI to subscribe to
    public onApprovalRequest?: (message: string) => Promise<boolean>;
    public onMetadataUpdate?: (metadata: ActMetadata) => void;
    public onActUpdate?: (update: any, metadata: ActMetadata) => void;
    public onOpen?: () => void;
    public onClose?: () => void;
    public onError?: (error: any) => void;

    constructor(run_id: string) {
        this.socket = new WebSocket(`ws://localhost:8000/ws/run/${run_id}`);
        this.run_id = run_id;

        this.socket.onopen = () => {
            if (this.onOpen) this.onOpen();
            this.send({ type: "start" });
        };

        this.socket.onerror = (error) => {
            if (this.onError) this.onError(error);
        };

        this.socket.onclose = () => {
            if (this.onClose) this.onClose();
        };

        this.socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'status':
                    const _data = data.data || {};
                    if (!_data) return;
                    switch (_data.status) {
                        case 'error':
                            console.error("Nova Act run error:", _data.error);
                            this.onError?.(_data.error)
                            break;
                        case 'started':
                            console.log("Nova Act run started");
                            this.act_started = true;
                            break;
                    }
                    break;
                case 'request':
                    if (this.onApprovalRequest) {
                        const approved = await this.onApprovalRequest(data.payload?.message || '');
                        this.send({
                            type: 'response',
                            request_id: data.request_id,
                            payload: { approved }
                        });
                    }
                    break;
                case 'metadata':
                    console.log("Received metadata:", data.data);
                    if (this.onMetadataUpdate) {
                        this.onMetadataUpdate(data.data);
                    }
                    break;
                case 'act_update':
                    const metadata: ActMetadata = data.metadata || {};
                    console.log("Received act update:", data.update);
                    if (this.onActUpdate) {
                        this.onActUpdate(data.update, metadata);
                    }
                    break;
                case 'page_error':
                    console.error(`Page error on ${data.page}:`, data.errors);
                    break;
                default:
                    console.log("Received message:", data);
            }
        };
    }

    send(data: any) {
        this.socket.send(JSON.stringify(data));
    }

    getRunId() {
        return this.run_id;
    }
}
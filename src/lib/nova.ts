import { ActRequestBody } from "@/types/nova";

export async function startNovaActJob(data: ActRequestBody): Promise<string> {
    const response = await fetch("/api/aws", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    const resData = await response.json();

    if (response.ok && resData.data?.run_id) {
        return resData.data.run_id as string;
    }

    throw new Error(resData.error || "Failed to start Nova Act job");
}

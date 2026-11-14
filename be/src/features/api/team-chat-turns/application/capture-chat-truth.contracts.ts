import type { CaptureFact } from "@modules/domain/team-chat-turns"

/** What the CaptureChatTruth operation takes: "Ghi vao Second Brain" on one message of the team chat. */
export interface CaptureChatTruthRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves the person sees the room and is the owner or a manager. */
    readonly workspaceId: string
    /** The person's message to file. */
    readonly messageId: string
    /** The agent that files it; null in a private room with an agent. */
    readonly agentId?: string | null | undefined
    /** The truth as written on the form; null lets the agent draft it. */
    readonly fact?: CaptureFact | null | undefined
}

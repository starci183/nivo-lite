import type { ChatAnswerRequest } from "@modules/domain/chatreply"

/** The bounded application request for queues the decision of a waiting customer escalation. */
export interface RequestChatAnswerRequest extends ChatAnswerRequest {
    /** The workspace selector; the domain service proves membership. */
    readonly workspaceId: string
}

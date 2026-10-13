import type { ChatReplyRequest } from "@modules/domain/chatreply"

/** The bounded application request for stores a member reply and queues its delivery. */
export interface RequestChatReplyRequest extends ChatReplyRequest {
    /** The workspace selector; the domain service proves membership. */
    readonly workspaceId: string
}

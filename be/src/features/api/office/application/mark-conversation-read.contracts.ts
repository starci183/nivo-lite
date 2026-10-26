import type { ConversationKind } from "@modules/domain/office-rooms"

/** What marking a direct conversation read takes. */
export interface MarkConversationReadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Which direct conversation: one agent's lines, or one customer's. */
    readonly kind: ConversationKind
    /** The agent or lead id of the conversation. */
    readonly id: string
}

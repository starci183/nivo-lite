import type { ChatTarget } from "@modules/domain/chat-markers"

/** A chat target in the workspace selected by X-Workspace-Id. */
export interface ChatMarkerRequest {
    /** The selected workspace; the service proves active membership. */
    readonly workspaceId: string
    /** The Office room or agent/customer conversation. */
    readonly target: ChatTarget
}

/** A receipt for the last message the caller actually fetched or read. */
export interface ChatReceiptRequest extends ChatMarkerRequest {
    /** The persisted message bounding the receipt. */
    readonly messageId: string
}

/** Changes only the current member's notification preference. */
export interface ChatMuteRequest extends ChatMarkerRequest {
    /** True to render a muted indicator for this member. */
    readonly muted: boolean
}

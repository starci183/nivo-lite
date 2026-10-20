import type { MessageCursor } from "@modules/domain/office-command-candidates"

/** What reading the Office thread takes. */
export interface ListThreadMessagesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only messages older than this position; null for the newest page. */
    readonly before: MessageCursor | null
    /** The page size, clamped to 1..100. */
    readonly limit: number
    /** Only this Hub room; null reads every room. */
    readonly room: string | null
}

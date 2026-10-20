/** What marking a Hub room read takes. */
export interface MarkRoomReadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The room; null is the general Office room. */
    readonly room: string | null
}

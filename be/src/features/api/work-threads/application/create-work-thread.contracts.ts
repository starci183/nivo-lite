/** What the CreateWorkThread operation takes. */
export interface CreateWorkThreadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The title of the thread. */
    readonly title: string
    /** The lead the thread is about, or null. */
    readonly leadId: string | null
    /** The order the thread is about, or null. */
    readonly orderId: string | null
}

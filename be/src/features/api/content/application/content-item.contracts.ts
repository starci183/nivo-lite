/** Identifies one post in the selected workspace. */
export interface GetContentItemRequest {
    /** The workspace; the service verifies membership. */
    readonly workspaceId: string
    /** The post to read. */
    readonly id: string
}

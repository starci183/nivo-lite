/** What the DeleteConnection operation takes. */
export interface DeleteConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the DeleteConnection operation answers. */
export type DeleteConnectionResult = void

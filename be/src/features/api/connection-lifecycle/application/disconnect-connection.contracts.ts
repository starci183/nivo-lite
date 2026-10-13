/** What the DisconnectConnection operation takes. */
export interface DisconnectConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the DisconnectConnection operation answers. */
export type DisconnectConnectionResult = void

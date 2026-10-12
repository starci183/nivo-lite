import type { ConnectionCheck } from "@modules/domain/channel-connections"

/** What the CheckConnection operation takes. */
export interface CheckConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the CheckConnection operation answers. */
export type CheckConnectionResult = ConnectionCheck

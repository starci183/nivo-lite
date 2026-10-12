import type { FirstEventState } from "@modules/domain/connections"

/** What check first event takes. */
export interface CheckFirstEventRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}

/** What check first event answers. */
export type CheckFirstEventResult = FirstEventState

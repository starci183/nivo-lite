import type { UpdateConnectionField } from "./update-connection.contracts"

/** What runConnectionAction takes. */
export interface RunConnectionActionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account. */
    readonly connectionId: string
    /** The key of the declared action. */
    readonly action: string
    /** The inputs the action declares; absent = none. */
    readonly fields?: ReadonlyArray<UpdateConnectionField> | null | undefined
}

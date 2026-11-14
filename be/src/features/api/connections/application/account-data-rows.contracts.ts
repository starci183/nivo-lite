import type { AccountDataRowsRequest } from "@modules/domain/account-data"

/** What accountDataTypes takes. */
export interface AccountDataTypesRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account. */
    readonly connectionId: string
}

/** What accountDataRows takes, in a workspace. */
export interface AccountDataRowsQueryRequest extends AccountDataRowsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

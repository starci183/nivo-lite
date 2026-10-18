import type { GetGoogleStateRequest, GoogleStateResult } from "../../application/get-google-state.contracts"
import type { GoogleStateType } from "./dto/google-state.type"

/** Maps the GraphQL arguments of googleConnectionState to the request. */
export const toGetGoogleStateRequest = (workspaceId: string): GetGoogleStateRequest => ({
    workspaceId,
})

/** Maps the answer of googleConnectionState to the GraphQL type. */
export const toGetGoogleStateType = (result: GoogleStateResult): GoogleStateType => result

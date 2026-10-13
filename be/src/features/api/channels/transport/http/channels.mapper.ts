import type { ZaloAuthorization } from "@modules/domain/channels"
import type { CompleteZaloAuthorizationRequest as CompleteCommandRequest } from "../../application/complete-zalo-authorization.contracts"
import type { CompleteZaloAuthorizationRequest } from "./dto/complete-zalo-authorization.request"
import type { ZaloAuthorizationResponse } from "./dto/zalo-authorization.response"
import type { ZaloConnectionResponse } from "./dto/zalo-connection.response"

/** Maps the authorization to the HTTP response. */
export const toZaloAuthorizationResponse = (result: ZaloAuthorization): ZaloAuthorizationResponse => ({
    url: result.url,
    callbackUrl: result.callbackUrl,
})

/** Maps the completed connection id to the HTTP response. */
export const toZaloConnectionResponse = (connectionId: string): ZaloConnectionResponse => ({ connectionId })

/** Maps the HTTP request to the command request. */
export const toCompleteRequest = (workspaceId: string, input: CompleteZaloAuthorizationRequest): CompleteCommandRequest => ({
    workspaceId,
    zaloReturn: { state: input.state, code: input.code, ...(input.oaId === undefined ? {} : { oaId: input.oaId }) },
})

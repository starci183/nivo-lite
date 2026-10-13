import type { AuthorizeZaloRequest } from "../../application/authorize-zalo.contracts"
import type { ZaloAuthorization } from "@modules/domain/channels"
import type { AuthorizeZaloInput } from "./dto/authorize-zalo.input"
import type { ZaloAuthorizationType } from "./dto/zalo-authorization.type"

/** Maps the GraphQL arguments of authorizeZalo to the request. */
export const toAuthorizeZaloRequest = (workspaceId: string, input: AuthorizeZaloInput): AuthorizeZaloRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of authorizeZalo to the GraphQL type. */
export const toAuthorizeZaloType = (result: ZaloAuthorization): ZaloAuthorizationType => result

import type { AuthorizeMetaRequest } from "../../application/authorize-meta.contracts"
import type { MetaAuthorization } from "@modules/domain/meta-connections"
import type { AuthorizeMetaInput } from "./dto/authorize-meta.input"
import type { MetaAuthorizationType } from "./dto/meta-authorization.type"

/** Maps the GraphQL arguments of authorizeMeta to the request. */
export const toAuthorizeMetaRequest = (workspaceId: string, input: AuthorizeMetaInput): AuthorizeMetaRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of authorizeMeta to the GraphQL type. */
export const toAuthorizeMetaType = (result: MetaAuthorization): MetaAuthorizationType => result

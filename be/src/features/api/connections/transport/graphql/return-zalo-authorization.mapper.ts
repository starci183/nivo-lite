import type { ReturnZaloAuthorizationRequest } from "../../application/return-zalo-authorization.contracts"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { ReturnZaloAuthorizationInput } from "./dto/return-zalo-authorization.input"
import type { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"

/** Maps the GraphQL arguments of returnZaloAuthorization to the request. */
export const toReturnZaloAuthorizationRequest = (
    workspaceId: string,
    input: ReturnZaloAuthorizationInput,
): ReturnZaloAuthorizationRequest => ({
    workspaceId,
    state: input.state,
    code: input.code,
    oaId: input.oaId,
})

/** Maps the answer of returnZaloAuthorization to the GraphQL type. */
export const toReturnZaloAuthorizationType = (result: ZaloWizardConnection): ZaloWizardConnectionType => result

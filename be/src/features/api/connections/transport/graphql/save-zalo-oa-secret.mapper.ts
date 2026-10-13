import type { SaveZaloOaSecretRequest } from "../../application/save-zalo-oa-secret.contracts"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { SaveZaloOaSecretInput } from "./dto/save-zalo-oa-secret.input"
import type { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"

/** Maps the GraphQL arguments of saveZaloOaSecret to the request. */
export const toSaveZaloOaSecretRequest = (
    workspaceId: string,
    input: SaveZaloOaSecretInput,
): SaveZaloOaSecretRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    oaSecret: input.oaSecret,
})

/** Maps the answer of saveZaloOaSecret to the GraphQL type. */
export const toSaveZaloOaSecretType = (result: ZaloWizardConnection): ZaloWizardConnectionType => result

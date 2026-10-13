import type { GetZaloConnectionRequest } from "../../application/get-zalo-connection.contracts"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { GetZaloConnectionInput } from "./dto/get-zalo-connection.input"
import type { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"

/** Maps the GraphQL arguments of zaloConnection to the request. */
export const toGetZaloConnectionRequest = (
    workspaceId: string,
    input: GetZaloConnectionInput,
): GetZaloConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of zaloConnection to the GraphQL type. */
export const toGetZaloConnectionType = (result: ZaloWizardConnection): ZaloWizardConnectionType => result

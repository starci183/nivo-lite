import type { StartZaloConnectionRequest } from "../../application/start-zalo-connection.contracts"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { StartZaloConnectionInput } from "./dto/start-zalo-connection.input"
import type { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"

/** Maps the GraphQL arguments of startZaloConnection to the request. */
export const toStartZaloConnectionRequest = (
    workspaceId: string,
    input: StartZaloConnectionInput,
): StartZaloConnectionRequest => ({
    workspaceId,
    name: input.name,
    appId: input.appId,
    appSecret: input.appSecret,
})

/** Maps the answer of startZaloConnection to the GraphQL type. */
export const toStartZaloConnectionType = (result: ZaloWizardConnection): ZaloWizardConnectionType => result

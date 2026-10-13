import type { CheckConnectionRequest } from "../../application/check-connection.contracts"
import type { ConnectionCheck } from "@modules/domain/channel-connections"
import type { CheckConnectionInput } from "./dto/check-connection.input"
import type { ConnectionCheckType } from "./dto/connection-check.type"

/** Maps the GraphQL arguments of checkConnection to the request. */
export const toCheckConnectionRequest = (workspaceId: string, input: CheckConnectionInput): CheckConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of checkConnection to the GraphQL type. */
export const toCheckConnectionType = (result: ConnectionCheck): ConnectionCheckType => result

import type { ListConnectionsRequest } from "../../application/list-connections.contracts"
import type { ConnectionBoardEntry } from "@modules/domain/connection-grants"
import type { ConnectionType } from "./dto/connection.type"

/** Maps the GraphQL arguments of connections to the request. */
export const toListConnectionsRequest = (workspaceId: string): ListConnectionsRequest => ({
    workspaceId,
})

/** Maps the answer of connections to the GraphQL type. */
export const toListConnectionsType = (result: ReadonlyArray<ConnectionBoardEntry>): Array<ConnectionType> =>
    result.map((entry) => ({
        ...entry.connection,
        botUsername: entry.botUsername,
        accountMasked: entry.accountMasked,
        agentIds: entry.grants.map((grant) => grant.agentId),
        grants: entry.grants,
    }))

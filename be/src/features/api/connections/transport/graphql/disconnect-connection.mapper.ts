import type { DisconnectConnectionRequest } from "../../application/disconnect-connection.contracts"
import type { DisconnectConnectionInput } from "./dto/disconnect-connection.input"

/** Maps the GraphQL arguments of disconnectConnection to the request. */
export const toDisconnectConnectionRequest = (
    workspaceId: string,
    input: DisconnectConnectionInput,
): DisconnectConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

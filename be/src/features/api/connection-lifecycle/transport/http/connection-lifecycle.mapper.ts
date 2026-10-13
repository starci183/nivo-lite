import type { DisconnectConnectionRequest } from "../../application/disconnect-connection.contracts"
import type { DeleteConnectionRequest } from "../../application/delete-connection.contracts"

/** Maps the HTTP path and body to the DisconnectConnection request. */
export const toDisconnectConnectionRequest = (
    workspaceId: string,
    connectionId: string,
): DisconnectConnectionRequest => ({ workspaceId, connectionId })

/** Maps the HTTP path and body to the DeleteConnection request. */
export const toDeleteConnectionRequest = (workspaceId: string, connectionId: string): DeleteConnectionRequest => ({
    workspaceId,
    connectionId,
})

import type { DisconnectDriveRequest } from "../../application/disconnect-drive.contracts"

/** Maps the GraphQL arguments of disconnectDrive to the request. */
export const toDisconnectDriveRequest = (workspaceId: string): DisconnectDriveRequest => ({ workspaceId })

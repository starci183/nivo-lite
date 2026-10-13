import type { SaveImapConnectionRequest } from "../../application/save-imap-connection.contracts"
import type { SaveImapConnectionInput } from "./dto/save-imap-connection.input"
import { toImapInput } from "./imap-connection.mapper"

/** Maps the GraphQL arguments of saveImapConnection to the request. */
export const toSaveImapConnectionRequest = (
    workspaceId: string,
    input: SaveImapConnectionInput,
): SaveImapConnectionRequest => ({ workspaceId, input: toImapInput(input) })

import type { ImapView } from "@modules/domain/data-hub"
import type { LoadImapConnectionRequest } from "../../application/load-imap-connection.contracts"
import type { ImapConnectionType } from "./dto/imap-connection.type"
import type { LoadImapConnectionInput } from "./dto/load-imap-connection.input"

/** Maps the GraphQL arguments of loadImapConnection to the request. */
export const toLoadImapConnectionRequest = (
    workspaceId: string,
    input: LoadImapConnectionInput,
): LoadImapConnectionRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the saved mailbox to the GraphQL type. */
export const toImapConnectionType = (view: ImapView): ImapConnectionType => ({
    ...view,
    folders: [...view.folders],
    agentIds: [...view.agentIds],
})

import { Query } from "@nestjs/cqrs"
import type { ImapView } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadImapConnectionRequest } from "./load-imap-connection.contracts"

/** Reads a saved mailbox connection for editing, without its password. */
export class LoadImapConnectionQuery extends Query<ImapView> {
    constructor(readonly params: ExecuteParams<LoadImapConnectionRequest>) {
        super()
    }
}

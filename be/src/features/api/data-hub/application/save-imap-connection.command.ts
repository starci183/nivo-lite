import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveImapConnectionRequest } from "./save-imap-connection.contracts"

/** Creates a mailbox connection or updates an existing one. */
export class SaveImapConnectionCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<SaveImapConnectionRequest>) {
        super()
    }
}

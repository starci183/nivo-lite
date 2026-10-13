import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DisconnectConnectionRequest } from "./disconnect-connection.contracts"

/** Disconnects a connection. */
export class DisconnectConnectionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DisconnectConnectionRequest>) {
        super()
    }
}

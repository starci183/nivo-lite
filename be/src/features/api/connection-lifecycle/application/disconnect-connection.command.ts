import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DisconnectConnectionRequest, DisconnectConnectionResult } from "./disconnect-connection.contracts"

/** Stops using a connection. */
export class DisconnectConnectionCommand extends Command<DisconnectConnectionResult> {
    constructor(readonly params: ExecuteParams<DisconnectConnectionRequest>) {
        super()
    }
}

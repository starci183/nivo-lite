import { Command } from "@nestjs/cqrs"
import type { ConnectionCheck } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckConnectionRequest } from "./check-connection.contracts"

/** Asks the provider what it knows about a connection. */
export class CheckConnectionCommand extends Command<ConnectionCheck> {
    constructor(readonly params: ExecuteParams<CheckConnectionRequest>) {
        super()
    }
}

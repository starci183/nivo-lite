import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckConnectionRequest, CheckConnectionResult } from "./check-connection.contracts"

/** Asks the provider what it knows about a connection. */
export class CheckConnectionCommand extends Command<CheckConnectionResult> {
    constructor(readonly params: ExecuteParams<CheckConnectionRequest>) {
        super()
    }
}

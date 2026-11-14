import { Command } from "@nestjs/cqrs"
import type { ConnectionActionResult } from "@modules/domain/connection-fields"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunConnectionActionRequest } from "./run-connection-action.contracts"

/** Runs one declared action of an account through the writer of its provider. */
export class RunConnectionActionCommand extends Command<ConnectionActionResult> {
    constructor(readonly params: ExecuteParams<RunConnectionActionRequest>) {
        super()
    }
}

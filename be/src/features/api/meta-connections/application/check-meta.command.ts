import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckMetaRequest, CheckMetaResult } from "./check-meta.contracts"

/** Asks Meta what it has for a connection. */
export class CheckMetaCommand extends Command<CheckMetaResult> {
    constructor(readonly params: ExecuteParams<CheckMetaRequest>) {
        super()
    }
}

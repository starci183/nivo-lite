import { Command } from "@nestjs/cqrs"
import type { MetaCheck } from "@modules/domain/meta-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckMetaRequest } from "./check-meta.contracts"

/** Asks Meta what it knows about a connection, optionally repairing the subscriptions. */
export class CheckMetaCommand extends Command<MetaCheck> {
    constructor(readonly params: ExecuteParams<CheckMetaRequest>) {
        super()
    }
}

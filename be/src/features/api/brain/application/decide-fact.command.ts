import { Command } from "@nestjs/cqrs"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideFactRequest } from "./decide-fact.contracts"

/** Asks to decide a waiting fact or retire an active one. */
export class DecideFactCommand extends Command<FactRecord> {
    constructor(readonly params: ExecuteParams<DecideFactRequest>) {
        super()
    }
}

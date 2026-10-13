import { Command } from "@nestjs/cqrs"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideBrainFactRequest } from "./decide-brain-fact.contracts"

/** Applies, rejects, chooses, splits or retires a fact. */
export class DecideBrainFactCommand extends Command<FactRecord> {
    constructor(readonly params: ExecuteParams<DecideBrainFactRequest>) {
        super()
    }
}

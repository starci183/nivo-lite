import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KeepCurrentBrainFactRequest } from "./keep-current-brain-fact.contracts"

/** Keeps the value in force and rejects every waiting value of its key. */
export class KeepCurrentBrainFactCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<KeepCurrentBrainFactRequest>) {
        super()
    }
}

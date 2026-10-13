import { Command } from "@nestjs/cqrs"
import type { ProposeResult } from "@modules/domain/brain-facts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBrainFactRequest } from "./save-brain-fact.contracts"

/** Writes a fact, or a new value for an existing one; it is applied at once. */
export class SaveBrainFactCommand extends Command<ProposeResult> {
    constructor(readonly params: ExecuteParams<SaveBrainFactRequest>) {
        super()
    }
}

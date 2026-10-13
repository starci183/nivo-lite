import { Command } from "@nestjs/cqrs"
import type { ProposeResult } from "@modules/domain/brain-facts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveFactRequest } from "./save-fact.contracts"

/** Asks to write a fact on the Second Brain page. */
export class SaveFactCommand extends Command<ProposeResult> {
    constructor(readonly params: ExecuteParams<SaveFactRequest>) {
        super()
    }
}

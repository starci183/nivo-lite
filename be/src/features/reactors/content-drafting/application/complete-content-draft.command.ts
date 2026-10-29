import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CompleteContentDraftRequest } from "./complete-content-draft.contracts"

/** Asks to apply one delivered ai_generation_completed event; the ai_generation_completed consumer sends it for every delivery. */
export class CompleteContentDraftCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<CompleteContentDraftRequest>) {
        super()
    }
}

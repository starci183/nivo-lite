import { Command } from "@nestjs/cqrs"
import type { CritiqueReviewView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrainCritiqueSourceRequest } from "./brain-critic.contracts"

/** Asks for the critique of a document again. */
export class RetryBrainCritiqueCommand extends Command<CritiqueReviewView> {
    constructor(readonly params: ExecuteParams<BrainCritiqueSourceRequest>) {
        super()
    }
}

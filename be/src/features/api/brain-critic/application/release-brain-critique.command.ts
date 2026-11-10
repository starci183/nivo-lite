import { Command } from "@nestjs/cqrs"
import type { CritiqueServingView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrainCritiqueSourceRequest } from "./brain-critic.contracts"

/** Lets customers read a document whose critique could not finish (founder only). */
export class ReleaseBrainCritiqueCommand extends Command<CritiqueServingView> {
    constructor(readonly params: ExecuteParams<BrainCritiqueSourceRequest>) {
        super()
    }
}

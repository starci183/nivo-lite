import { Command } from "@nestjs/cqrs"
import type { CritiquePointView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SkipBrainCritiqueRequest } from "./brain-critic.contracts"

/** Skips one point of a critique. */
export class SkipBrainCritiqueCommand extends Command<CritiquePointView> {
    constructor(readonly params: ExecuteParams<SkipBrainCritiqueRequest>) {
        super()
    }
}

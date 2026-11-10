import { Command } from "@nestjs/cqrs"
import type { CritiquePointView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AnswerBrainCritiqueRequest } from "./brain-critic.contracts"

/** Answers one point of a critique (founder only); never applies a truth. */
export class AnswerBrainCritiqueCommand extends Command<CritiquePointView> {
    constructor(readonly params: ExecuteParams<AnswerBrainCritiqueRequest>) {
        super()
    }
}

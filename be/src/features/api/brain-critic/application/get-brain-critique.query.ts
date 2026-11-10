import { Query } from "@nestjs/cqrs"
import type { CritiqueView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBrainCritiqueRequest } from "./brain-critic.contracts"

/** Reads the critique of one shop document. */
export class GetBrainCritiqueQuery extends Query<CritiqueView> {
    constructor(readonly params: ExecuteParams<GetBrainCritiqueRequest>) {
        super()
    }
}

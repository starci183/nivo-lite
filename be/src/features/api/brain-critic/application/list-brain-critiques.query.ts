import { Query } from "@nestjs/cqrs"
import type { CritiqueSourceView } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListBrainCritiquesRequest } from "./brain-critic.contracts"

/** Lists the critiqued documents of the workspace. */
export class ListBrainCritiquesQuery extends Query<ReadonlyArray<CritiqueSourceView>> {
    constructor(readonly params: ExecuteParams<ListBrainCritiquesRequest>) {
        super()
    }
}

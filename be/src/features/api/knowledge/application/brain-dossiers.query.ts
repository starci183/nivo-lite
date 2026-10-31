import { Query } from "@nestjs/cqrs"
import type { DossierRecord } from "@modules/domain/brain-dossiers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BrainDossiersRequest } from "./brain-dossiers.contracts"

/** Asks for the dossiers the workspace tracks, with the documents that name each. */
export class BrainDossiersQuery extends Query<ReadonlyArray<DossierRecord>> {
    constructor(readonly params: ExecuteParams<BrainDossiersRequest>) {
        super()
    }
}

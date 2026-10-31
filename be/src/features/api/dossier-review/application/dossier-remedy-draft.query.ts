import { Query } from "@nestjs/cqrs"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DossierRemedyDraftRequest } from "./dossier-remedy-draft.contracts"

/** A draft, or null when the workspace has no such draft. */
export type OptionalRemedyDraft = RemedyDraftRecord | null

/** Reads one remedy draft, or nothing when it does not exist in the workspace. */
export class DossierRemedyDraftQuery extends Query<OptionalRemedyDraft> {
    constructor(readonly params: ExecuteParams<DossierRemedyDraftRequest>) {
        super()
    }
}

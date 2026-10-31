import { Command } from "@nestjs/cqrs"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RejectDossierRemedyDraftRequest } from "./reject-dossier-remedy-draft.contracts"

/** Rejects a proposed draft; the finding stays as it was. */
export class RejectDossierRemedyDraftCommand extends Command<RemedyDraftRecord> {
    constructor(readonly params: ExecuteParams<RejectDossierRemedyDraftRequest>) {
        super()
    }
}

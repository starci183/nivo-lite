import { Command } from "@nestjs/cqrs"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApproveDossierRemedyDraftRequest } from "./approve-dossier-remedy-draft.contracts"

/** Approves a proposed draft: it becomes a document of the dossier and the finding is resolved. */
export class ApproveDossierRemedyDraftCommand extends Command<RemedyDraftRecord> {
    constructor(readonly params: ExecuteParams<ApproveDossierRemedyDraftRequest>) {
        super()
    }
}

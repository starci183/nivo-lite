import { Command } from "@nestjs/cqrs"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveDossierRemedyDraftRequest } from "./save-dossier-remedy-draft.contracts"

/** Saves the owner's edits of a proposed draft. */
export class SaveDossierRemedyDraftCommand extends Command<RemedyDraftRecord> {
    constructor(readonly params: ExecuteParams<SaveDossierRemedyDraftRequest>) {
        super()
    }
}

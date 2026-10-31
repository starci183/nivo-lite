import { Command } from "@nestjs/cqrs"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestDossierRemedyDraftRequest } from "./request-dossier-remedy-draft.contracts"

/** Asks NIVO to draft the document that completes a finding. */
export class RequestDossierRemedyDraftCommand extends Command<RemedyDraftRecord> {
    constructor(readonly params: ExecuteParams<RequestDossierRemedyDraftRequest>) {
        super()
    }
}

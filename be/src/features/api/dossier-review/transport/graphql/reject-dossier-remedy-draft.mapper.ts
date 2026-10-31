import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { RejectDossierRemedyDraftRequest } from "../../application/reject-dossier-remedy-draft.contracts"
import type { RejectDossierRemedyDraftInput } from "./dto/reject-dossier-remedy-draft.input"
import type { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"

/** Maps the GraphQL input to the request. */
export const toRejectDossierRemedyDraftRequest = (
    workspaceId: string,
    input: RejectDossierRemedyDraftInput,
): RejectDossierRemedyDraftRequest => ({
    workspaceId,
    draftId: input.draftId,
    reason: input.reason,
})

/** The record already has the shape of the GraphQL type. */
export const toRejectDossierRemedyDraftType = (result: RemedyDraftRecord): DossierRemedyDraftType => result

import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { ApproveDossierRemedyDraftRequest } from "../../application/approve-dossier-remedy-draft.contracts"
import type { DossierRemedyDraftRefInput } from "./dto/dossier-remedy-draft-ref.input"
import type { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"

/** Maps the GraphQL input to the request. */
export const toApproveDossierRemedyDraftRequest = (
    workspaceId: string,
    input: DossierRemedyDraftRefInput,
): ApproveDossierRemedyDraftRequest => ({
    workspaceId,
    draftId: input.draftId,
})

/** The record already has the shape of the GraphQL type. */
export const toApproveDossierRemedyDraftType = (result: RemedyDraftRecord): DossierRemedyDraftType => result

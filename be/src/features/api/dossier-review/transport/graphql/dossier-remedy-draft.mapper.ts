import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { DossierRemedyDraftRequest } from "../../application/dossier-remedy-draft.contracts"
import type { DossierRemedyDraftRefInput } from "./dto/dossier-remedy-draft-ref.input"
import type { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"

/** Maps the GraphQL input to the request. */
export const toDossierRemedyDraftRequest = (
    workspaceId: string,
    input: DossierRemedyDraftRefInput,
): DossierRemedyDraftRequest => ({ workspaceId, draftId: input.draftId })

/** The record already has the shape of the GraphQL type. */
export const toDossierRemedyDraftType = (result: RemedyDraftRecord | null): DossierRemedyDraftType | null => result

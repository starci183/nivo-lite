import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { SaveDossierRemedyDraftRequest } from "../../application/save-dossier-remedy-draft.contracts"
import type { SaveDossierRemedyDraftInput } from "./dto/save-dossier-remedy-draft.input"
import type { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"

/** Maps the GraphQL input to the request. */
export const toSaveDossierRemedyDraftRequest = (
    workspaceId: string,
    input: SaveDossierRemedyDraftInput,
): SaveDossierRemedyDraftRequest => ({
    workspaceId,
    draftId: input.draftId,
    title: input.title,
    body: input.body,
})

/** The record already has the shape of the GraphQL type. */
export const toSaveDossierRemedyDraftType = (result: RemedyDraftRecord): DossierRemedyDraftType => result

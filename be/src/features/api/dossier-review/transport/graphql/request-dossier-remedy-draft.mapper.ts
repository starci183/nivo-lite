import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import type { RequestDossierRemedyDraftRequest } from "../../application/request-dossier-remedy-draft.contracts"
import type { RequestDossierRemedyDraftInput } from "./dto/request-dossier-remedy-draft.input"
import type { DossierRemedyDraftType } from "./dto/dossier-remedy-draft.type"

/** Maps the GraphQL input to the request. */
export const toRequestDossierRemedyDraftRequest = (
    workspaceId: string,
    input: RequestDossierRemedyDraftInput,
): RequestDossierRemedyDraftRequest => ({
    workspaceId,
    findingId: input.findingId,
    instructions: input.instructions,
})

/** The record already has the shape of the GraphQL type. */
export const toRequestDossierRemedyDraftType = (result: RemedyDraftRecord): DossierRemedyDraftType => result

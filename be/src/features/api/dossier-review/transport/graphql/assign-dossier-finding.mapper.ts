import type { FindingRecord } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { AssignDossierFindingRequest } from "../../application/assign-dossier-finding.contracts"
import type { AssignDossierFindingInput } from "./dto/assign-dossier-finding.input"
import type { DossierFindingType } from "./dto/dossier-finding.type"

/** Maps the GraphQL input to the request. */
export const toAssignDossierFindingRequest = (
    workspaceId: string,
    locale: Locale,
    input: AssignDossierFindingInput,
): AssignDossierFindingRequest => ({
    workspaceId,
    locale,
    findingId: input.findingId,
    assigneeId: input.assigneeId,
    dueAt: input.dueAt,
})

/** The record already has the shape of the GraphQL type. */
export const toAssignDossierFindingType = (result: FindingRecord): DossierFindingType => result

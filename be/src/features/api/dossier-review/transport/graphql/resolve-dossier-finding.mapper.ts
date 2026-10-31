import type { FindingRecord } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { ResolveDossierFindingRequest } from "../../application/resolve-dossier-finding.contracts"
import type { ResolveDossierFindingInput } from "./dto/resolve-dossier-finding.input"
import type { DossierFindingType } from "./dto/dossier-finding.type"

/** Maps the GraphQL input to the request. */
export const toResolveDossierFindingRequest = (
    workspaceId: string,
    locale: Locale,
    input: ResolveDossierFindingInput,
): ResolveDossierFindingRequest => ({
    workspaceId,
    locale,
    findingId: input.findingId,
    note: input.note,
})

/** The record already has the shape of the GraphQL type. */
export const toResolveDossierFindingType = (result: FindingRecord): DossierFindingType => result

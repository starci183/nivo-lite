import type { FindingRecord } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { ReopenDossierFindingRequest } from "../../application/reopen-dossier-finding.contracts"
import type { DossierFindingRefInput } from "./dto/dossier-finding-ref.input"
import type { DossierFindingType } from "./dto/dossier-finding.type"

/** Maps the GraphQL input to the request. */
export const toReopenDossierFindingRequest = (
    workspaceId: string,
    locale: Locale,
    input: DossierFindingRefInput,
): ReopenDossierFindingRequest => ({
    workspaceId,
    locale,
    findingId: input.findingId,
})

/** The record already has the shape of the GraphQL type. */
export const toReopenDossierFindingType = (result: FindingRecord): DossierFindingType => result

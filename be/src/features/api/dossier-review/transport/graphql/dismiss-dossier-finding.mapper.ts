import type { FindingRecord } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { DismissDossierFindingRequest } from "../../application/dismiss-dossier-finding.contracts"
import type { DismissDossierFindingInput } from "./dto/dismiss-dossier-finding.input"
import type { DossierFindingType } from "./dto/dossier-finding.type"

/** Maps the GraphQL input to the request. */
export const toDismissDossierFindingRequest = (
    workspaceId: string,
    locale: Locale,
    input: DismissDossierFindingInput,
): DismissDossierFindingRequest => ({
    workspaceId,
    locale,
    findingId: input.findingId,
    reason: input.reason,
})

/** The record already has the shape of the GraphQL type. */
export const toDismissDossierFindingType = (result: FindingRecord): DossierFindingType => result

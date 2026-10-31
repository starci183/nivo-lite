import type { FindingRecord } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { ConfirmDossierFindingRequest } from "../../application/confirm-dossier-finding.contracts"
import type { DossierFindingNoteInput } from "./dto/dossier-finding-note.input"
import type { DossierFindingType } from "./dto/dossier-finding.type"

/** Maps the GraphQL input to the request. */
export const toConfirmDossierFindingRequest = (
    workspaceId: string,
    locale: Locale,
    input: DossierFindingNoteInput,
): ConfirmDossierFindingRequest => ({
    workspaceId,
    locale,
    findingId: input.findingId,
    note: input.note,
})

/** The record already has the shape of the GraphQL type. */
export const toConfirmDossierFindingType = (result: FindingRecord): DossierFindingType => result

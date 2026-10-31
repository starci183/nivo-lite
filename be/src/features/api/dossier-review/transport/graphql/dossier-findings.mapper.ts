import type { FindingPage } from "@modules/domain/dossier-review"
import type { Locale } from "@modules/platform/i18n"
import type { DossierFindingsRequest } from "../../application/dossier-findings.contracts"
import type { DossierFindingsInput } from "./dto/dossier-findings.input"
import type { DossierFindingConnectionType } from "./dto/dossier-finding-connection.type"

/** Maps the GraphQL input to the request. */
export const toDossierFindingsRequest = (
    workspaceId: string,
    locale: Locale,
    input: DossierFindingsInput,
): DossierFindingsRequest => ({
    workspaceId,
    locale,
    first: input.first,
    after: input.after,
    dossierId: input.dossierId,
    statuses: input.statuses,
    severities: input.severities,
    assigneeId: input.assigneeId,
    unassigned: input.unassigned,
    draftsAwaiting: input.draftsAwaiting,
})

/** The record already has the shape of the GraphQL type. */
export const toDossierFindingsType = (result: FindingPage): DossierFindingConnectionType => result

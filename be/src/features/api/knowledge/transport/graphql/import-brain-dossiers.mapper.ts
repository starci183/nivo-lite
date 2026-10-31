import type { DossierImportResult } from "@modules/domain/brain-dossiers"
import type { ImportBrainDossiersRequest } from "../../application/import-brain-dossiers.contracts"
import type { BrainDossierImportType } from "./dto/brain-dossier-import.type"
import type { ImportBrainDossiersInput } from "./dto/import-brain-dossiers.input"

/** Maps the GraphQL input to the request. */
export const toImportBrainDossiersRequest = (
    workspaceId: string,
    input: ImportBrainDossiersInput,
): ImportBrainDossiersRequest => ({
    workspaceId,
    name: input.name,
    contentBase64: input.contentBase64,
    sheet: input.sheet,
})

/** Maps the answer to the GraphQL type. */
export const toBrainDossierImportType = (result: DossierImportResult): BrainDossierImportType => ({ ...result })

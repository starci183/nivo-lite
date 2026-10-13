import type { CsvImportResult } from "@modules/domain/data-hub"
import type { RunDocumentImportRequest } from "../../application/run-document-import.contracts"
import type { CsvImportResultType } from "./dto/csv-import-result.type"
import type { RunDocumentImportInput } from "./dto/run-document-import.input"

/** Maps the GraphQL arguments of runDocumentImport to the request. */
export const toRunDocumentImportRequest = (
    workspaceId: string,
    input: RunDocumentImportInput,
): RunDocumentImportRequest => ({
    workspaceId,
    ...input,
})

/** Maps the answer of runDocumentImport to the GraphQL type. */
export const toRunDocumentImportType = (result: CsvImportResult): CsvImportResultType => result

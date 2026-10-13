import type { CsvImportResult } from "@modules/domain/data-hub"
import type { RunCsvImportRequest } from "../../application/run-csv-import.contracts"
import type { CsvImportResultType } from "./dto/csv-import-result.type"
import type { RunCsvImportInput } from "./dto/run-csv-import.input"

/** Maps the GraphQL arguments of runCsvImport to the request. */
export const toRunCsvImportRequest = (workspaceId: string, input: RunCsvImportInput): RunCsvImportRequest => ({
    workspaceId,
    ...input,
})

/** Maps the answer of runCsvImport to the GraphQL type. */
export const toRunCsvImportType = (result: CsvImportResult): CsvImportResultType => result

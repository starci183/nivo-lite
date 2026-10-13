import type { CsvSavedImport } from "@modules/domain/data-hub"
import type { LoadCsvImportRequest } from "../../application/load-csv-import.contracts"
import type { CsvSavedImportType } from "./dto/csv-saved-import.type"
import type { LoadCsvImportInput } from "./dto/load-csv-import.input"

/** Maps the GraphQL arguments of loadCsvImport to the request. */
export const toLoadCsvImportRequest = (workspaceId: string, input: LoadCsvImportInput): LoadCsvImportRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of loadCsvImport to the GraphQL type. */
export const toLoadCsvImportType = (result: CsvSavedImport): CsvSavedImportType => result

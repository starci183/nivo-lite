import type { CsvImportRequest } from "@modules/domain/data-hub"

/** What runCsvImport takes: the source, the mapping, the name and the schedule, in a workspace. */
export interface RunCsvImportRequest extends CsvImportRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

import type { CsvSourceRequest } from "@modules/domain/data-hub"

/** What previewCsvSource takes: the source to read, in a workspace. */
export interface PreviewCsvSourceRequest extends CsvSourceRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

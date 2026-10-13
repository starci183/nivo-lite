import type { DocumentImportRequest } from "@modules/domain/data-hub"

/** What runDocumentImport takes: the documents and the name, in a workspace. */
export interface RunDocumentImportRequest extends DocumentImportRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

import type { DatabasePreviewDraft } from "@modules/domain/data-hub"

/** What previewDatabaseTable takes. */
export interface PreviewDatabaseTableRequest extends DatabasePreviewDraft {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

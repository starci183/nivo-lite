import type { DatabaseSaveDraft } from "@modules/domain/data-hub"

/** What saveDatabaseConnection takes. */
export interface SaveDatabaseConnectionRequest extends DatabaseSaveDraft {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

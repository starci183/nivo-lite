import type { DatabaseTestDraft } from "@modules/domain/data-hub"

/** What testDatabase takes. */
export interface TestDatabaseRequest extends DatabaseTestDraft {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

import type { ContentCadenceDraft } from "@modules/domain/content-settings"

/** Arguments of saveContentCadence. */
export interface SaveContentCadenceRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
    /** Configuration to save. */
    readonly rows: ReadonlyArray<ContentCadenceDraft>
}

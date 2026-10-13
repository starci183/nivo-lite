import type { ContentPillarDraft } from "@modules/domain/content-settings"

/** Arguments of saveContentPillars. */
export interface SaveContentPillarsRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
    /** Configuration to save. */
    readonly rows: ReadonlyArray<ContentPillarDraft>
}

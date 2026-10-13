import type { AutomationRunView } from "@modules/domain/automations"

/** What list runs takes. */
export interface ListRunsRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The template; empty for every template. */
    readonly templateKey: string
}

/** What list runs answers. */
export type ListRunsResult = ReadonlyArray<AutomationRunView>

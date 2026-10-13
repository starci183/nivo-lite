import type { AutomationSuggestion } from "@modules/domain/automations"

/** What suggest automations takes. */
export interface SuggestAutomationsRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The module; empty for the workspace-wide templates. */
    readonly moduleKey: string
}

/** What suggest automations answers. */
export type SuggestAutomationsResult = ReadonlyArray<AutomationSuggestion>

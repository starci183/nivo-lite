import type { AutomationMarks, AutomationSwitches } from "../content-settings.contracts"

/** One workspace that has a content automation switched on. */
export interface TickWorkspaceRow {
    /** The workspace. */
    readonly workspace_id: string
    /** Which automations are on. */
    readonly automations: AutomationSwitches
    /** What they last did. */
    readonly marks: AutomationMarks
}

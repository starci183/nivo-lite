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

/** The guideline brand columns of one workspace. */
export interface GuidelineBrandRow {
    /** The palette JSON. */
    readonly brand_colors: unknown
    /** The font families. */
    readonly brand_fonts: ReadonlyArray<string>
    /** The tone of voice. */
    readonly brand_tone: string
    /** The imagery. */
    readonly brand_imagery: ReadonlyArray<string>
    /** What drafts avoid. */
    readonly avoid: string
}

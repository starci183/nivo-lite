/** Which content automations a workspace switched on. */
export interface AutomationSwitches {
    /** The reminder of what is due today. */
    readonly today_reminder?: boolean
    /** The ideas for new offers. */
    readonly offer_draft?: boolean
    /** The summary of last week. */
    readonly weekly_summary?: boolean
}

/** The dedupe marks of the automations: what they last did, so a repeated tick changes nothing twice. */
export interface AutomationMarks {
    /** The Vietnam date (yyyy-mm-dd) the reminder was last sent. */
    readonly reminder_day?: string
    /** The Monday (yyyy-mm-dd) of the week the summary was last sent. */
    readonly summary_week?: string
    /** The ISO instant the offers were last looked at. */
    readonly offer_seen_at?: string
}

/** A workspace that has a content automation switched on. */
export interface TickWorkspace {
    /** The workspace. */
    readonly workspaceId: string
    /** Which automations are on. */
    readonly automations: AutomationSwitches
    /** What they last did. */
    readonly marks: AutomationMarks
}

/** One named brand color, `#rrggbb`. */
export interface GuidelineColor {
    /** The name the guideline gives it. */
    readonly name: string
    /** The hex value. */
    readonly hex: string
}

/** The brand read from a guideline and confirmed by the owner, as the content settings keep it. */
export interface GuidelineBrand {
    /** The palette, primary first. */
    readonly colors: ReadonlyArray<GuidelineColor>
    /** The font families. */
    readonly fonts: ReadonlyArray<string>
    /** The tone of voice. */
    readonly tone: string
    /** The imagery the guideline asks for. */
    readonly imagery: ReadonlyArray<string>
    /** The file the brand was read from. */
    readonly source: string
    /** The brand voice line drafts follow. */
    readonly voice: string
    /** What drafts avoid, one per line. */
    readonly avoid: string
}

/** The stored guideline brand of a workspace; the colors are as stored (validated by the reader). */
export interface StoredGuidelineBrand {
    /** The stored palette JSON. */
    readonly colors: unknown
    /** The font families. */
    readonly fonts: ReadonlyArray<string>
    /** The tone of voice. */
    readonly tone: string
    /** The imagery. */
    readonly imagery: ReadonlyArray<string>
    /** What drafts avoid, one per line. */
    readonly avoid: string
}

/** The stored guideline brand, or null when the workspace has no settings. */
export type OptionalStoredGuidelineBrand = StoredGuidelineBrand | null

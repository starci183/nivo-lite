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

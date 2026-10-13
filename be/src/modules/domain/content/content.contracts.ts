/** The three content automations a workspace can switch on. */
export type AutomationKey = "today_reminder" | "offer_draft" | "weekly_summary"

/** One automation that did something for a workspace in a tick. */
export interface TickDone {
    /** The workspace it ran for. */
    readonly workspaceId: string
    /** Which automation ran. */
    readonly job: AutomationKey
    /** How many posts the automation reminded about, summarised or turned into ideas. */
    readonly count: number
}

/** What a tick is asked to do. */
export interface TickRequest {
    /** Run the switched-on automations of this workspace only. */
    readonly workspaceId?: string
    /** Ignore the time window and the day or week marks (an operator check). Honoured only together with `workspaceId`. */
    readonly force?: boolean
}

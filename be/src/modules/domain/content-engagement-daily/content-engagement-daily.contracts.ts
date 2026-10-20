/** One day of one channel's engagement. */
export interface EngagementDayRecord {
    /** The channel. */
    readonly channel: string
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** Unique people reached. */
    readonly reach: number
    /** Engagements. */
    readonly engagements: number
    /** New messages. */
    readonly messages: number
}

/** One day a provider reported for one channel. */
export interface ReportedDay {
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** Unique people reached. */
    readonly reach: number
    /** Engagements. */
    readonly engagements: number
}

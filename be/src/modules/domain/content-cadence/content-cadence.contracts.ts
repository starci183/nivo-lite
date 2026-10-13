/** A channel the workspace can publish content to. */
export type ContentChannel = "facebook" | "zalo" | "tiktok" | "instagram"

/** A channel's weekly posting rhythm. */
export interface ContentCadenceDraft {
    /** The publishing channel. */
    readonly channel: ContentChannel
    /** The number of posts planned each week. */
    readonly postsPerWeek: number
    /** ISO weekdays, where Monday is one. */
    readonly days: ReadonlyArray<number>
    /** Vietnam local posting time in HH:mm. */
    readonly time: string
}

/** A saved posting rhythm. */
export interface ContentCadence extends ContentCadenceDraft {
    /** The saved theme or cadence identifier. */
    readonly id: string
    /** The workspace that owns this configuration. */
    readonly workspaceId: string
}

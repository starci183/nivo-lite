import type { ContentChannel } from "../content-cadence.contracts"

/** A stored content-cadence row. */
export interface ContentCadenceRow {
    /** Stored id value. */
    readonly id: string
    /** Stored workspace id value. */
    readonly workspace_id: string
    /** Stored channel value. */
    readonly channel: ContentChannel
    /** Stored posts per week value. */
    readonly posts_per_week: number
    /** Stored days value. */
    readonly days: Array<number>
    /** Stored post time value. */
    readonly post_time: string
}

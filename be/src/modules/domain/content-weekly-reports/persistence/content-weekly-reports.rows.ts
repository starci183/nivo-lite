import type { WeeklyPost, WeeklySuggestion } from "../content-weekly-reports.contracts"

/** One stored week as SQL reads it. */
export interface WeeklyReportRow {
    /** The top posts. */
    readonly posts: ReadonlyArray<WeeklyPost>
    /** How many posts were published. */
    readonly post_count: number
    /** The suggestion, or null. */
    readonly suggestion: WeeklySuggestion | null
    /** When the extras were computed, ISO text, or null. */
    readonly computed_at: string | null
    /** When the card was posted, ISO text, or null. */
    readonly posted_at: string | null
}

/** The week a posting claim took. */
export interface ClaimedWeekRow {
    /** The week, `YYYY-MM-DD`. */
    readonly week_start: string
}

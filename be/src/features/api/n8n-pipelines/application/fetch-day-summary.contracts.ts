/** What fetch day summary takes. */
export interface FetchDaySummaryRequest {
    /** The bearer header of the run. */
    readonly authorization: string
    /** The day; empty for today. */
    readonly date: string
}

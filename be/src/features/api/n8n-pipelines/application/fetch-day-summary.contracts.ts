import type { RunAuthorization } from "@modules/domain/n8n-runs"

/** What fetch day summary takes. */
export interface FetchDaySummaryRequest {
    /** The bearer header of the run. */
    readonly authorization: RunAuthorization
    /** The day; empty for today. */
    readonly date: string
}

import type { RunAuthorization, N8nCompletion } from "@modules/domain/n8n-runs"

/** What complete run takes. */
export interface CompleteRunRequest {
    /** The bearer header of the run. */
    readonly authorization: RunAuthorization
    /** The run. */
    readonly runId: string
    /** How it ended. */
    readonly report: N8nCompletion
}

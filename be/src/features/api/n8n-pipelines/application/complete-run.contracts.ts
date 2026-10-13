import type { N8nCompletion } from "@modules/domain/n8n-runs"

/** What complete run takes. */
export interface CompleteRunRequest {
    /** The bearer header of the run. */
    readonly authorization: string
    /** The run. */
    readonly runId: string
    /** How it ended. */
    readonly report: N8nCompletion
}

/** What complete run answers. */
export type CompleteRunResult = void

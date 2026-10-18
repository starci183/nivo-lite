import type { RunAuthorization } from "@modules/domain/n8n-runs"

/** What fetch month ledger takes. */
export interface FetchMonthLedgerRequest {
    /** The bearer header of the run. */
    readonly authorization: RunAuthorization
    /** The month, yyyy-mm; empty for last month. */
    readonly period: string
}

/** What fetch month ledger takes. */
export interface FetchMonthLedgerRequest {
    /** The bearer header of the run. */
    readonly authorization: string
    /** The month, yyyy-mm; empty for last month. */
    readonly period: string
}

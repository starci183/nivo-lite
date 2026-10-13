/** public.contracts as the statements select it: days as YYYY-MM-DD text, the amount as a number. */
export interface ContractsRow {
    /** The contract id. */
    readonly id: string
    /** The lead the contract belongs to, or null. */
    readonly lead_id: string | null
    /** The customer name shown on the contract. */
    readonly customer_name: string
    /** The plan the contract covers. */
    readonly plan: string
    /** The first day, `YYYY-MM-DD`. */
    readonly starts_on: string
    /** The last day, `YYYY-MM-DD`. */
    readonly ends_on: string
    /** The amount in VND, or null when none is set. */
    readonly amount_vnd: number | null
    /** The contract status. */
    readonly status: string
    /** The note kept with the contract. */
    readonly note: string
}

/** public.contracts as the statements select it: days as YYYY-MM-DD text, the amount as a number. */
export interface ContractsRow {
    readonly id: string
    readonly lead_id: string | null
    readonly customer_name: string
    readonly plan: string
    readonly starts_on: string
    readonly ends_on: string
    readonly amount_vnd: number | null
    readonly status: string
    readonly note: string
}

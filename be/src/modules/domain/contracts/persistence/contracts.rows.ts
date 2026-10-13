/** public.contracts as the statements select it: days as YYYY-MM-DD text, the amount as a number. */
export interface ContractsRow {
    /** The contract row id. */
    readonly id: string
    /** The lead the contract was won from; null when entered without one. */
    readonly lead_id: string | null
    /** The customer the contract is signed with, as shown in lists. */
    readonly customer_name: string
    /** The plan or package the customer bought. */
    readonly plan: string
    /** The first day the contract is in force, YYYY-MM-DD. */
    readonly starts_on: string
    /** The last day the contract is in force, YYYY-MM-DD; renewal reminders count down to it. */
    readonly ends_on: string
    /** The contract value in VND; null when not recorded. */
    readonly amount_vnd: number | null
    /** The stored lifecycle status, parsed into a contract status before use. */
    readonly status: string
    /** Free-text remarks kept with the contract. */
    readonly note: string
}

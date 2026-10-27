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

/** One contract as the customer link reads it, with the phone and the email of the lead it links to. */
export interface ContractLinkRow {
    /** The contract row id. */
    readonly id: string
    /** The lead the contract links to; null when it has none. */
    readonly lead_id: string | null
    /** The customer the contract is signed with. */
    readonly customer_name: string
    /** The plan or package the customer bought. */
    readonly plan: string
    /** Free-text remarks; the first segment is the contract reference. */
    readonly note: string
    /** The phone of the linked lead, or null. */
    readonly lead_phone: string | null
    /** The email of the linked lead, or null. */
    readonly lead_email: string | null
}

/** One customer record of the data hub (public.data_records, entity `customer`) with the name of the source it came from. */
export interface CustomerRecordRow {
    /** The id of the record in its source. */
    readonly external_id: string
    /** The display title of the record. */
    readonly title: string
    /** The columns of the record, keyed by their header. */
    readonly data: Readonly<Record<string, unknown>>
    /** The name of the data-hub connection the record was synced from, or null. */
    readonly source: string | null
}

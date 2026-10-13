/** The HTTP response of save-contract. */
export class SaveContractResponse {
    /** The contract id. */
    id!: string
    /** The customer it links to. */
    leadId!: string | null
    /** The customer name. */
    customerName!: string
    /** The plan. */
    plan!: string
    /** The first day, YYYY-MM-DD. */
    startsOn!: string
    /** The last day, YYYY-MM-DD. */
    endsOn!: string
    /** The recurring amount in whole dong. */
    amountVnd!: number | null
    /** `active`, `ended` or `cancelled`. */
    status!: string
    /** A free note. */
    note!: string
}

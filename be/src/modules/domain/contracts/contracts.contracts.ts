/** The statuses a recurring sales contract can hold. */
export const CONTRACT_STATUSES = ["active", "ended", "cancelled"] as const

/** What a sales contract is saved from; dates are YYYY-MM-DD and the amount is whole dong. */
export interface SaveContractParams {
    /** The workspace the contract belongs to. */
    readonly workspaceId: string
    /** The contract to edit; null adds a new one. */
    readonly contractId: string | null
    /** The customer the contract links to, when one is known. */
    readonly leadId: string | null
    /** The customer name. */
    readonly customerName: string
    /** The plan the customer buys. */
    readonly plan: string
    /** The first day, YYYY-MM-DD. */
    readonly startsOn: string
    /** The last day, YYYY-MM-DD. */
    readonly endsOn: string
    /** The recurring amount in whole dong; null when not agreed. */
    readonly amountVnd: number | null
    /** `active`, `ended` or `cancelled`. */
    readonly status: string
    /** A free note. */
    readonly note: string
    /** The signed-in caller; the workspace members service proves the membership and names the actor. */
    readonly userId: string
    /** The `Accept-Language` header of the request; the evidence line is written in the language it names. */
    readonly acceptLanguage: string | undefined
}

/** One recurring sales contract as the capability answers it. */
export interface ContractResult {
    /** The contract id. */
    readonly id: string
    /** The customer it links to. */
    readonly leadId: string | null
    /** The customer name. */
    readonly customerName: string
    /** The plan. */
    readonly plan: string
    /** The first day, YYYY-MM-DD. */
    readonly startsOn: string
    /** The last day, YYYY-MM-DD. */
    readonly endsOn: string
    /** The recurring amount in whole dong. */
    readonly amountVnd: number | null
    /** `active`, `ended` or `cancelled`. */
    readonly status: string
    /** A free note. */
    readonly note: string
}

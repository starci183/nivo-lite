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

/** What a paid renewal did to its contract. */
export interface PaidRenewal {
    /** True when the contract moved to its next term; false when it no longer ended on the renewed day or is cancelled. */
    readonly extended: boolean
    /** The contract as it stands afterwards. */
    readonly contract: ContractResult
    /** The last day of the contract before the renewal, YYYY-MM-DD. */
    readonly previousEndsOn: string
}

/** Why a contract could not be linked to a reachable customer. */
export type UnmatchedReason = "noCustomer" | "noContact" | "ambiguous"

/** A contract the customer link left without a phone or an email to reach the customer by. */
export interface UnmatchedContract {
    /** The contract id. */
    readonly contractId: string
    /** The customer name the contract carries. */
    readonly customerName: string
    /**
     * `noCustomer` when no customer record has its name or code, `noContact` when the record has no phone and no email,
     * `ambiguous` when several records with that name hold different contacts.
     */
    readonly reason: UnmatchedReason
}

/** What linking the contracts of a workspace to their customers did. */
export interface LinkedCustomers {
    /** How many contracts moved to a reachable lead, or whose lead gained the customer's phone or email. */
    readonly linked: number
    /** How many leads were created for customers the workspace did not have as a lead yet. */
    readonly created: number
    /** The contracts still without a way to reach the customer, each with its reason. */
    readonly unmatched: ReadonlyArray<UnmatchedContract>
}

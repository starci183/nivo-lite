/** One contract of a workspace as other capabilities read it. */
export interface ContractFacts {
    /** The contract id. */
    readonly id: string
    /** The customer name. */
    readonly customerName: string
    /** The lead the contract links to; null when none. */
    readonly leadId: string | null
    /** The plan. */
    readonly plan: string
    /** The last day, YYYY-MM-DD. */
    readonly endsOn: string
    /** The recurring amount in whole dong; null when not agreed. */
    readonly amountVnd: number | null
    /** `active`, `ended` or `cancelled`. */
    readonly status: string
}

/** A contract, or none when the workspace has no such contract. */
export type OptionalContractFacts = ContractFacts | undefined

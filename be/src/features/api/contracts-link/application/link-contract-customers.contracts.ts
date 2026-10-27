/** What linking the contracts of a workspace to their customers takes. */
export interface LinkContractCustomersRequest {
    /** The workspace the caller acts in, named in X-Workspace-Id; the domain service proves the caller membership in it. */
    readonly workspaceId: string
}

/** A contract still without a way to reach its customer. */
export interface UnmatchedContractResult {
    /** The contract id. */
    readonly contractId: string
    /** The customer name the contract carries. */
    readonly customerName: string
    /** `noCustomer`, `noContact` or `ambiguous`. */
    readonly reason: string
}

/** What linking the contracts answers. */
export interface LinkContractCustomersResult {
    /** How many contracts now reach a lead they did not reach before. */
    readonly linked: number
    /** How many leads were created. */
    readonly created: number
    /** The contracts still without a phone or an email to reach the customer by. */
    readonly unmatched: ReadonlyArray<UnmatchedContractResult>
}

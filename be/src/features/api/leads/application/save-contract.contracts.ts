import type { ContractActor } from "@modules/domain/contracts"

/** What saving a recurring contract takes; dates are YYYY-MM-DD and the amount is whole dong. */
export interface SaveContractRequest {
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
    /** The workspace the caller acts in, established by the workspace guard. */
    readonly workspaceId: string
    /** The caller in that workspace; the evidence log shows the name. */
    readonly actor: ContractActor
    /** The `Accept-Language` header of the request; the evidence lines use the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What saving a contract answers: the contract as stored. */
export interface SaveContractResult {
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

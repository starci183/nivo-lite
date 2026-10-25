import type { LeadRequestBody } from "./public-api.contracts"

/** The admitted API details a gated handoff settles once it has a customer. */
export interface PublicLeadMetadata {
    /** The original request or pre-ledger inbound UUID, retained for replay dedupe. */
    readonly completionId: string
    /** The ledger request to link, or null for a historical inline delivery. */
    readonly ledgerRequestId: string | null
    /** The admitted customer details, carried durably until capture passes its gate. */
    readonly body: LeadRequestBody
}

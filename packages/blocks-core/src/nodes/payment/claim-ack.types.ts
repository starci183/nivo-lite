import type { NodeLocale } from "../node-schema.types"

/** The per-graph settings of the acknowledgement. */
export interface ClaimAckParams {
    /** The language of the reply. */
    readonly locale: NodeLocale
}

/** The claim the customer made. */
export interface ClaimAckInput {
    /** The conversation to answer in. */
    readonly conversationId: string
    /** The lead the claim is about, or null while the conversation has none yet (a new customer): the claim then belongs to the conversation. */
    readonly leadId: string | null
    /** The message in which the customer claimed. */
    readonly body: string
    /** The amount claimed, VND, or null. */
    readonly amountVnd: number | null
    /** The name on the transfer, or null. */
    readonly payerName: string | null
}

/** What was recorded and sent. */
export interface ClaimAckOutput {
    /** The neutral reply that was sent. */
    readonly reply: string
    /** The recorded claim. */
    readonly claim: { readonly kind: string; readonly id: string }
}

/** The words of the acknowledgement in one language. */
export interface ClaimAckWords {
    /** The reply with no detail; the checked claim is not yet true. */
    readonly plain: string
    /** The reply naming the amount; takes `{{amount}}`. */
    readonly amount: string
    /** The currency suffix after an amount. */
    readonly currency: string
}

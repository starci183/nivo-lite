import type { NativeCaller } from "../tool-caller.contracts"

/**
 * Whose credits a run may see on the credit list (flipDecisions2026_11_13 #3: the credit list shown to a model carries no other credit's
 * customer). `customer`: a run that serves a customer (its conversation's lead, or the run's own lead with no conversation), which sees
 * only the credits whose named order is that lead's; `leadId` null (a conversation with no customer, or one whose customer the adapter
 * was not told) sees none. `internal`: a run that serves no customer (the bank trigger's run, the engine's own work), which handles one
 * credit at a time.
 */
export type CreditReach =
    | { readonly kind: "customer"; readonly leadId: string | null }
    | { readonly kind: "internal" }

/**
 * The reach of a caller. `conversationLead` is the lead of the caller's conversation as the caller of the adapter resolved it (absent:
 * not resolved, so a conversation sees nothing). No caller is the platform's own code reading for itself: internal.
 */
export const creditReachOf = (
    caller: NativeCaller | undefined,
    conversationLead: string | null | undefined,
): CreditReach => {
    if (caller === undefined) return { kind: "internal" }
    if (caller.conversationId !== null) return { kind: "customer", leadId: conversationLead ?? null }
    const runLead = caller.run?.leadId ?? null
    return runLead === null ? { kind: "internal" } : { kind: "customer", leadId: runLead }
}

/** The order a credit's transfer content names, as the credit list answers it: its customer (`leadId`) only where the reach shows it. */
export interface NamedOrder {
    /** The order the transfer content names. */
    readonly orderId: string
    /** The order number, as the customer reads it. */
    readonly orderNo: string
    /** The customer of the order, or null when it has none. */
    readonly leadId: string | null
}

/** What the list shows of one credit's named order, or `hidden` when the credit is not shown at all. */
export type CreditShown = { readonly kind: "shown"; readonly namedOrder: NamedOrder | null } | { readonly kind: "hidden" }

/**
 * What a reach shows of one credit (`named`: the one awaiting order its content names, or null):
 * - a customer run: the credit only when it names an order of ITS lead, in full; any other credit (another customer's, or one that names
 *   no order: its content and payer may be anyone's) is not shown;
 * - an internal run that named the credit (`focused`): the credit with its named order in full (the step's own credit);
 * - an internal run that named none: the credit with its named order WITHOUT the customer (`leadId` null); the order's id and number
 *   are the shop's own and stay, so a step can still tell which order the money names.
 */
export const creditShownOf = (reach: CreditReach, named: NamedOrder | null, focused: boolean): CreditShown => {
    if (reach.kind === "customer") {
        if (reach.leadId === null || named === null) return { kind: "hidden" }
        if (named.leadId !== reach.leadId) return { kind: "hidden" }
        return { kind: "shown", namedOrder: { ...named } }
    }
    if (named === null) return { kind: "shown", namedOrder: null }
    return { kind: "shown", namedOrder: focused ? { ...named } : { ...named, leadId: null } }
}

import type { ContactIdentity } from "@modules/domain/contacts/contacts.contracts"
import { DELIVERY_OUTCOME_UNKNOWN, type StoredDelivery } from "@modules/domain/customer-routes"
import { SEND_REFUSAL, type CustomerMessageReceipt, type ReceiptState } from "./chat-node-ports.policy"

/** The stored inbound messages the Zalo reply window reads: the raw message type of the Zalo OA, its indexed person member, and the member that says the direction. */
export const ZALO_MESSAGE_TYPE = "zalo_oa.message"
/** The member of the raw Zalo message that names the person (the first member of its declared index). */
export const ZALO_MESSAGE_PERSON = "userId"
/** The member of the raw message that says which way it went. */
export const MESSAGE_DIRECTION = "direction"
/** The direction of a message the customer wrote: only these open the reply window. */
export const INBOUND = "in"

/** Where a message goes: one channel identity of the person (the channel, the account, the channel's id of them). */
export interface Reach {
    /** The channel key. */
    readonly channel: string
    /** The account: the connection id (the site id of the website). */
    readonly accountId: string
    /** The person's id on that channel. */
    readonly userId: string
}

/** What the call and the run say about where the message goes. */
export interface ReachAsked {
    /** The channel named by the call, or undefined. */
    readonly channel: string | undefined
    /** The account named by the call, or undefined. */
    readonly accountId: string | undefined
    /** The route the run was woken on, when it is the same person's: its channel and account. */
    readonly woken: { readonly channel: string; readonly accountId: string | null } | null
}

/** The identity a send reaches, or why none can be picked. */
export type ReachPicked =
    | { readonly kind: "picked"; readonly reach: Reach }
    | { readonly kind: "none"; readonly reason: typeof SEND_REFUSAL.noChannelIdentity; readonly channels: ReadonlyArray<string> }
    | { readonly kind: "ambiguous"; readonly reason: typeof SEND_REFUSAL.channelAmbiguous; readonly channels: ReadonlyArray<string> }

const reachOf = (identity: ContactIdentity): Reach => ({
    channel: identity.provider,
    accountId: identity.account,
    userId: identity.value,
})

/** The channels the person is known on, once each. */
export const channelsOf = (identities: ReadonlyArray<ContactIdentity>): ReadonlyArray<string> => [
    ...new Set(identities.filter((identity) => identity.kind === "channel").map((identity) => identity.provider)),
]

/**
 * The channel identity a message goes to. The call's channel and account narrow the person's channel identities; of what is left, the
 * route the run was woken on wins, a single identity is taken, and with no word from the call or the run the newest identity (the one
 * the person came in on last) is. Several identities of a channel the call named, with no account and no woken route among them, are
 * ambiguous: the caller names the account.
 */
export const reachPicked = (identities: ReadonlyArray<ContactIdentity>, asked: ReachAsked): ReachPicked => {
    const channels = channelsOf(identities)
    const known = identities.filter((identity) => identity.kind === "channel")
    const named = known.filter(
        (identity) =>
            (asked.channel === undefined || identity.provider === asked.channel) &&
            (asked.accountId === undefined || identity.account === asked.accountId),
    )
    const [first, ...rest] = named
    if (first === undefined) return { kind: "none", reason: SEND_REFUSAL.noChannelIdentity, channels }
    const woken = named.find(
        (identity) => asked.woken !== null && identity.provider === asked.woken.channel && identity.account === (asked.woken.accountId ?? ""),
    )
    if (woken !== undefined) return { kind: "picked", reach: reachOf(woken) }
    if (rest.length === 0) return { kind: "picked", reach: reachOf(first) }
    if (asked.channel !== undefined || asked.accountId !== undefined)
        return { kind: "ambiguous", reason: SEND_REFUSAL.channelAmbiguous, channels }
    const newest = named.reduce((latest, identity) => (identity.at > latest.at ? identity : latest), first)
    return { kind: "picked", reach: reachOf(newest) }
}

/**
 * True when the customer last wrote longer ago than the free window; a person with no inbound message on the account is open (as a
 * conversation they never wrote in was).
 */
export const windowClosedAt = (now: Date, lastInbound: Date | null, windowMs: number): boolean =>
    lastInbound !== null && now.getTime() - lastInbound.getTime() > windowMs

/** What a ledger row says, as the receipt of the send. */
const stateOf = (row: StoredDelivery): ReceiptState => {
    if (row.state === "delivered") return "delivered"
    return row.state === "refused" ? "refused" : "unknown"
}

/** The room a receipt is built from: where the message went and by which route. */
export interface ReceiptPlace {
    /** The person. */
    readonly contactId: string
    /** The channel. */
    readonly channel: string
    /** The account. */
    readonly accountId: string | null
    /** The route. */
    readonly routeId: string
}

/** The receipt a ledger row stands for: how the key ended, the same answer however often the key is asked. */
export const receiptOfRow = (row: StoredDelivery): CustomerMessageReceipt => {
    const state = stateOf(row)
    return {
        delivered: state === "delivered",
        state,
        reason: state === "delivered" ? null : (row.reason ?? (state === "unknown" ? DELIVERY_OUTCOME_UNKNOWN : null)),
        contactId: row.contactId,
        channel: row.channel,
        accountId: row.accountId,
        routeId: row.routeId,
        providerMessageId: row.providerMessageId,
        at: row.deliveredAt,
        sendKey: row.sendKey,
    }
}

/** The receipt of an attempt the engine ended itself: a refusal (or an unknown outcome) with the reason. */
export const receiptOf = (
    place: ReceiptPlace,
    sendKey: string,
    ended: { readonly state: ReceiptState; readonly reason: string | null; readonly via?: string | undefined; readonly at?: string | null },
): CustomerMessageReceipt => ({
    delivered: ended.state === "delivered",
    state: ended.state,
    reason: ended.reason,
    ...place,
    providerMessageId: null,
    ...(ended.via === undefined ? {} : { via: ended.via }),
    at: ended.at ?? null,
    sendKey,
})

/** The pictures a send shows, summed up for the ledger: their number and kinds (`image` for a picture the send carries). */
export const attachmentSummaryOf = (
    images: ReadonlyArray<{ readonly url: string }> | undefined,
): { readonly attachmentCount: number; readonly attachmentKinds: ReadonlyArray<string> } => ({
    attachmentCount: images?.length ?? 0,
    attachmentKinds: images === undefined || images.length === 0 ? [] : ["image"],
})

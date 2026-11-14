import type { LoyaltyConfig } from "./rules/config.types"
import type { LedgerKind } from "./rules/ledger.types"
import type { LoyaltyReward } from "./rules/reward.types"
import type { Segment } from "./rules/segment.types"
import type { MemberActivity } from "./rules/stats.types"

/** What a store answers to a write: the row as written, or why nothing was written. */
export type StoreResult<T> =
    { readonly ok: true; readonly row: T } | { readonly ok: false; readonly reason: "missing" | "conflict" }

/** One customer of the programme with the balance the ledger gives. */
export interface MemberRow {
    /** The customer id. */
    readonly id: string
    /** The version the row was read at; a write names it. */
    readonly version: string
    /** The name shown to the owner. */
    readonly name: string
    /** The phone, normalised, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** The birthday, `YYYY-MM-DD`, or null. */
    readonly birthday: string | null
    /** The key of the held tier, or null. */
    readonly tierKey: string | null
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** The purchases that earned points. */
    readonly visits: number
    /** When the last purchase earned points, ISO 8601, or null. */
    readonly lastVisitAt: string | null
    /** When the customer joined, ISO 8601. */
    readonly joinedAt: string
    /** The note of the owner. */
    readonly note: string
}

/** The profile fields an owner may change without changing a customer's identity or balance. */
export interface MemberPatch {
    /** The name, when changed. */
    readonly name?: string
    /** The birthday, when changed; null clears it. */
    readonly birthday?: string | null
    /** The owner's note, when changed. */
    readonly note?: string
    /** The held tier, when a purchase lifted it. */
    readonly tierKey?: string
    /** The name of the held tier, kept with the key so the list sorts and filters on stored fields. */
    readonly tier?: string
}

/** One row of the members list: what the list draws, with the tier written by name and the activity worked out. */
export interface MemberListRow {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The phone, else the email, else empty. */
    readonly contact: string
    /** The name of the held tier, empty before the first purchase. */
    readonly tier: string
    /** The key of the held tier, or null. */
    readonly tierKey: string | null
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** When the last purchase earned points, ISO 8601, or null. */
    readonly lastVisitAt: string | null
    /** Whether the customer bought lately, has gone quiet or is too new to tell. */
    readonly activity: MemberActivity
}

/** One entry of the append-only points ledger. */
export interface LedgerRow {
    /** The entry id. */
    readonly id: string
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added (positive) or taken (negative). */
    readonly points: number
    /** The spend that earned the points, or the cash value of the reward redeemed. */
    readonly amountVnd: number | null
    /** The text that explains the entry. */
    readonly evidence: string | null
    /** Who moved the points. */
    readonly by: string
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
    /** When the points moved, ISO 8601. */
    readonly occurredAt: string
}

/** What the ledger is told to write; posting the same `ref` twice changes nothing. */
export interface LedgerPost {
    /** The customer whose points move. */
    readonly customerId: string
    /** Why the points move. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** The idempotency key. */
    readonly ref: string
    /** Who moves the points. */
    readonly by: string
    /** The spend or the cash value behind the entry, or null. */
    readonly amountVnd: number | null
    /** The reward behind a redeem, or null. */
    readonly rewardId: string | null
    /** The text that explains the entry, or null. */
    readonly evidence: string | null
    /** When earned points expire, ISO 8601, or null. */
    readonly expiresAt: string | null
    /** When the points moved, ISO 8601. */
    readonly occurredAt: string
}

/** A reward of the catalogue as stored. */
export interface RewardRow extends LoyaltyReward {
    /** The version the row was read at. */
    readonly version: string
}

/** Whether removing a reward deleted an unused entry, found none, or paused an entry with history. */
export type RewardRemoval = "deleted" | "missing" | "retired"

/** The loyalty programme of a workspace. */
export interface ProgramRow {
    /** The name of the programme. */
    readonly name: string
    /** The slug of the public points page. */
    readonly slug: string
    /** Whether the programme is on. */
    readonly enabled: boolean
    /** The rules, resolved over the defaults. */
    readonly config: LoyaltyConfig
    /** The version the row was read at; absent before the first save. */
    readonly version: string | null
}

/** What a save of the programme writes. */
export interface ProgramSave {
    /** The name of the programme. */
    readonly name: string
    /** The slug of the public points page, made from the name when the programme is first saved. */
    readonly slug: string
    /** Whether the programme is on. */
    readonly enabled: boolean
    /** The complete rules. */
    readonly config: LoyaltyConfig
}

/** Where a campaign stands: drafting waits, a drafted message is a draft, a submitted draft waits for a decision. */
export type CampaignStatus = "waiting" | "draft" | "waiting_decision" | "sending" | "done" | "failed"

/** One campaign and its delivery counts. */
export interface CampaignRow {
    /** The campaign id. */
    readonly id: string
    /** The owner's campaign name. */
    readonly name: string
    /** The customers it targets. */
    readonly segment: Segment
    /** The generated or template message, with customer placeholders retained. */
    readonly draft: string
    /** Where the campaign stands. */
    readonly status: CampaignStatus
    /** The decision that authorizes sending, when one exists. */
    readonly workItemId: string | null
    /** The number of recipients. */
    readonly recipients: number
    /** Sent messages. */
    readonly sent: number
    /** Failed deliveries. */
    readonly failed: number
    /** Who requested the campaign. */
    readonly createdBy: string
    /** When it was requested, ISO 8601. */
    readonly createdAt: string
}

/** What the owner asks for when creating a campaign. */
export interface CampaignRequest {
    /** The name of the campaign; empty to name it after the segment. */
    readonly name: string
    /** Who the promotion is for. */
    readonly segment: Segment
    /** The offer, in the owner's words. */
    readonly brief: string
    /** The member who creates it, or null when the agent does. */
    readonly createdBy: string | null
}

/** A campaign written as a draft. */
export interface CampaignCreated {
    /** The campaign id. */
    readonly campaignId: string
    /** Where the campaign stands. */
    readonly status: CampaignStatus
    /** The customers it is for. */
    readonly recipients: number
}

/** One decision about loyalty that waits for a person. */
export interface DecisionItem {
    /** The work item id. */
    readonly id: string
    /** What the agent proposes: award_points, redeem_reward, send_promo or adjust_points. */
    readonly action: string
    /** The proposal in a line. */
    readonly summary: string
    /** The message the agent wrote, for a promotion; empty otherwise. */
    readonly draft: string
    /** Why the agent stopped for a person, or null. */
    readonly reason: string | null
    /** The sum the decision is about, in VND, or null. */
    readonly amountVnd: number | null
    /** When the decision was raised, ISO 8601. */
    readonly createdAt: string
    /** The customer the decision is about, or empty. */
    readonly customer: string
}

/** The verdict a person gives a decision. */
export type Verdict = "approved" | "rejected"

/** What the redemption of a reward came to. */
export interface Redeemed {
    /** The code the customer shows to receive the reward. */
    readonly code: string
    /** Whether the points were taken now; false when the key was used before. */
    readonly posted: boolean
}

/** What the sync of the members from the leads came to. */
export interface Synced {
    /** The customers created. */
    readonly created: number
    /** The leads and chats linked to customers. */
    readonly linked: number
}

/** The customers a segment holds. */
export interface SegmentCount {
    /** The customers the segment holds. */
    readonly total: number
}

import type { Segment } from "@modules/domain/loyalty-campaigns"
import type { ExpiringSoon, LedgerEntry, LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { NextTier } from "@modules/domain/loyalty-programs"
import type { LoyaltyReward, RedeemBlockMatch } from "@modules/domain/loyalty-rewards"

/** How many customers hold a tier. */
export interface TierCount {
    /** The key of the tier. */
    readonly key: string
    /** The name of the tier. */
    readonly name: string
    /** The customers holding it. */
    readonly count: number
}

/** The statistics of the loyalty workbench. */
export interface LoyaltyStats {
    /** The customers of the programme. */
    readonly members: number
    /** The customers who bought in the last 90 days. */
    readonly active90d: number
    /** The points customers hold together. */
    readonly pointsOutstanding: number
    /** The points earned in the last 30 days. */
    readonly earned30d: number
    /** The points redeemed in the last 30 days. */
    readonly redeemed30d: number
    /** The points that expired in the last 30 days. */
    readonly expired30d: number
    /** The redemptions of the last 30 days. */
    readonly redemptions30d: number
    /** The spend that earned points in the last 30 days, in VND. */
    readonly spend30d: number
    /** The cash value of the rewards given in the last 30 days, in VND. */
    readonly rewardValue30d: number
    /** The promotions sent in the last 30 days. */
    readonly promosSent30d: number
    /** The customers whose birthday is this month. */
    readonly birthdaysThisMonth: number
    /** The customers by tier. */
    readonly tierCounts: ReadonlyArray<TierCount>
}

/** The figures of the workbench ribbon. */
export interface LoyaltyFigures {
    /** The customers of the programme. */
    readonly members: number
    /** The customers who bought in the last 60 days. */
    readonly activeMembers: number
    /** The points earned in the last 30 days. */
    readonly pointsIssued30d: number
    /** The redemptions of the last 30 days. */
    readonly redemptions30d: number
    /** The points the redemptions of the last 30 days spent. */
    readonly pointsRedeemed30d: number
    /** The customers with no purchase for 60 days. */
    readonly atRisk: number
}

/** The statistics and the ribbon of the workbench. */
export interface LoyaltyOverview {
    /** The statistics. */
    readonly stats: LoyaltyStats
    /** The ribbon figures. */
    readonly figures: LoyaltyFigures
    /** The instant the figures were taken, ISO 8601. */
    readonly nowIso: string
}

/** A reward and why the customer cannot redeem it now, if they cannot. */
export interface RewardOption {
    /** The reward. */
    readonly reward: LoyaltyReward
    /** The refusal, or null when the customer can redeem it. */
    readonly block: RedeemBlockMatch
}

/** A customer with the timeline of the ledger and what they can redeem. */
export interface MemberDetail {
    /** The customer with the balance. */
    readonly member: LoyaltyMember
    /** The newest ledger entries. */
    readonly ledger: ReadonlyArray<LedgerEntry>
    /** The name of the held tier, or empty. */
    readonly tierName: string
    /** The next tier and the spend still missing, or null at the top. */
    readonly nextTier: NextTier | null
    /** The points about to expire. */
    readonly expiring: ExpiringSoon
    /** The active rewards, each with the reason it cannot be redeemed now. */
    readonly rewards: ReadonlyArray<RewardOption>
}

/** A customer of a workspace. */
export interface MemberRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly customerId: string
}

/** A manual correction of a balance. */
export interface AdjustParams extends MemberRef {
    /** The points added (positive) or taken (negative). */
    readonly points: number
    /** Why the owner corrects the balance. */
    readonly reason: string
    /** A token of the form: sending it twice corrects once. */
    readonly token: string
}

/** The answer to an adjustment. */
export interface AdjustResult {
    /** Whether the correction was written; false when the token was used before. */
    readonly posted: boolean
}

/** A reward redeemed for a customer at the counter. */
export interface RedeemParams extends MemberRef {
    /** The reward. */
    readonly rewardId: string
    /** A token of the form: sending it twice redeems once. */
    readonly token: string
}

/** The answer to a redemption. */
export interface RedeemResult {
    /** The code the customer shows to receive the reward. */
    readonly code: string
    /** Whether the redemption was written; false when the token was used before. */
    readonly posted: boolean
}

/** The answer to a sync of customers from leads. */
export interface SyncResult {
    /** The customers created. */
    readonly created: number
    /** The leads linked to a customer. */
    readonly linked: number
}

/** A workspace asked about. */
export interface WorkspaceRef {
    /** The workspace. */
    readonly workspaceId: string
}

/** One line of the note written into the ledger, to be looked up in the message catalog. */
export interface NotePart {
    /** The catalog key. */
    readonly key: string
    /** The values that fill the text. */
    readonly params: Readonly<Record<string, string | number>>
}

/** A message to deliver to a customer in their own chat. */
export interface CodeDeliveryParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation to write in. */
    readonly conversationId: string
    /** The text of the message. */
    readonly text: string
}

/** Carries a message to a customer through the channel of their own chat; the chat lanes provide it. */
export interface CodeDelivery {
    /** Sends the message; true when the channel accepted it. */
    deliver(params: CodeDeliveryParams): Promise<boolean>
}

/** Which page is asked about. */
export interface PublicPageParams {
    /** The slug of the public points page. */
    readonly slug: string
}

/** What the public points page shows before a code is asked for. */
export interface PublicProgramView {
    /** The slug of the page. */
    readonly slug: string
    /** The shop name. */
    readonly shop: string
    /** The name of the programme. */
    readonly name: string
}

/** Why a public check did not go ahead; `none` means it did. */
export type PublicCheckCode = "none" | "bad_phone" | "closed" | "busy" | "wrong"

/** A visitor asks for a code. */
export interface RequestCodeParams extends PublicPageParams {
    /** The phone the visitor bought with. */
    readonly phone: string
}

/** The answer to a code request; always the same for a visitor who is not a member. */
export interface RequestCodeAnswer {
    /** Whether the request was taken in. */
    readonly ok: boolean
    /** Why not, or `none`. */
    readonly code: PublicCheckCode
}

/** A visitor types the code they received. */
export interface VerifyCodeParams extends RequestCodeParams {
    /** The six digits typed. */
    readonly typed: string
}

/** One reward of the public page. */
export interface PublicRewardLine {
    /** The name of the reward. */
    readonly name: string
    /** The points it costs. */
    readonly pointsCost: number
    /** The note of the owner. */
    readonly note: string
    /** Whether the customer can redeem it now. */
    readonly canRedeem: boolean
}

/** What a customer sees of their points once the code was right. */
export interface PublicPoints {
    /** The shop name. */
    readonly shop: string
    /** The name of the customer. */
    readonly name: string
    /** The name of the held tier, or empty. */
    readonly tierName: string
    /** The points the customer holds. */
    readonly points: number
    /** The next tier and the spend still missing, or null at the top. */
    readonly nextTier: NextTier | null
    /** The points about to expire. */
    readonly expiring: ExpiringSoon
    /** The active rewards. */
    readonly rewards: ReadonlyArray<PublicRewardLine>
}

/** The answer to a typed code. */
export interface VerifyCodeAnswer {
    /** Whether the code was right. */
    readonly ok: boolean
    /** Why not, or `none`. */
    readonly code: PublicCheckCode
    /** The points, when the code was right. */
    readonly points: PublicPoints | null
}

/** The API key a till sends, as the `Authorization` header carries it. */
export interface ApiCall {
    /** The value of the `Authorization` header. */
    readonly authorization: string
}

/** A customer as the till sees them. */
export interface ApiMember {
    /** The customer id. */
    readonly customerId: string
    /** The name. */
    readonly name: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** The name of the held tier, or null. */
    readonly tier: string | null
    /** The points held. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** The purchases that earned points. */
    readonly visits: number
    /** When the last purchase earned points, or null. */
    readonly lastVisitAt: string | null
}

/** A till lists customers. */
export interface ApiMembersParams extends ApiCall {
    /** One customer's phone; absent or empty for the newest customers. */
    readonly phone?: string
    /** How many customers to list; fifty when absent. */
    readonly limit?: number
}

/** The customers a till asked for. */
export interface ApiMembersResult {
    /** The customers. */
    readonly members: ReadonlyArray<ApiMember>
}

/** A till reports a sale made outside NIVO. */
export interface ApiAwardParams extends ApiCall {
    /** The phone of the customer. */
    readonly phone: string
    /** The name of the customer, or empty. */
    readonly name: string
    /** The amount of the sale in VND. */
    readonly amountVnd: number
    /** The receipt id of the till: sending it twice gives points once. */
    readonly ref: string
    /** The items sold, matched against the category rates. */
    readonly items: string
    /** When the sale happened, ISO 8601, or empty for now. */
    readonly occurredAt: string
}

/** What a reported sale came to. */
export interface ApiAwardResult {
    /** `done` when points were written, `duplicate` when the receipt was seen before, `no_points` when the sale earns none. */
    readonly status: "done" | "duplicate" | "no_points"
    /** The customer after the sale. */
    readonly customer: ApiMember
}

/** A till redeems a reward. */
export interface ApiRedeemParams extends ApiCall {
    /** The phone of the customer, or empty. */
    readonly phone: string
    /** The id of the customer, or empty. */
    readonly customerId: string
    /** The key of the reward. */
    readonly rewardKey: string
    /** The key of the redemption: sending it twice redeems once. */
    readonly ref: string
}

/** The reward a till redeemed. */
export interface ApiRewardView {
    /** The key of the reward. */
    readonly key: string
    /** The name of the reward. */
    readonly name: string
    /** The cash value in VND. */
    readonly valueVnd: number
    /** The points it cost. */
    readonly pointsCost: number
}

/** What a redemption came to. */
export interface ApiRedeemResult {
    /** `done` when written, `duplicate` when the key was seen before. */
    readonly status: "done" | "duplicate"
    /** The code the customer shows to receive the reward. */
    readonly code: string
    /** The reward. */
    readonly reward: ApiRewardView
    /** The customer after the redemption. */
    readonly customer: ApiMember
}

/** A till asks for a promotion draft. */
export interface ApiPromoParams extends ApiCall {
    /** The name of the campaign, or empty. */
    readonly name: string
    /** The offer in the owner's words. */
    readonly brief: string
    /** Who the promotion is for. */
    readonly segment: Segment
}

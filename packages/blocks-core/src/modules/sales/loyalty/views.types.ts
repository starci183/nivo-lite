import type { CampaignStatus } from "./loyalty.types"
import type { LedgerKind } from "../../../rules/sales/loyalty/ledger.types"
import type { RewardKind } from "../../../rules/sales/loyalty/reward.types"

/** One tier of the ladder with the members who hold it. */
export interface TierRowView {
    /** The key of the tier. */
    readonly key: string
    /** The name of the tier. */
    readonly name: string
    /** The lifetime spend that reaches it, in VND. */
    readonly minSpendVnd: number
    /** The factor applied to the points earned by spend. */
    readonly multiplier: number
    /** What the tier gives. */
    readonly benefit: string
    /** The members who hold it. */
    readonly count: number
}

/** One customer in full: what the detail, the adjust form and the edit form draw. */
export interface MemberDetail {
    /** The customer id. */
    readonly id: string
    /** The name shown to the owner. */
    readonly name: string
    /** The phone, or empty. */
    readonly phone: string
    /** The email, or empty. */
    readonly email: string
    /** The birthday, `YYYY-MM-DD`, or empty. */
    readonly birthday: string
    /** The note of the owner. */
    readonly note: string
    /** The name of the held tier, empty before the first purchase. */
    readonly tier: string
    /** The points the customer holds. */
    readonly points: number
    /** The lifetime spend that earned points, in VND. */
    readonly lifetimeSpendVnd: number
    /** The purchases that earned points. */
    readonly visits: number
    /** When the last purchase earned points, ISO 8601, or empty. */
    readonly lastVisitAt: string
    /** When the customer joined, ISO 8601. */
    readonly joinedAt: string
    /** The name of the next tier, empty at the top. */
    readonly nextTier: string
    /** The spend still missing to reach the next tier, in VND; zero at the top. */
    readonly missingVnd: number
    /** The points that expire inside the warning window. */
    readonly expiringPoints: number
    /** When the first of those expires, ISO 8601, or empty. */
    readonly expiringAt: string
}

/** One reward the customer can redeem now. */
export interface RedeemableRowView {
    /** The id of the offer, which the redeem action takes: the customer and the reward. */
    readonly id: string
    /** The name of the reward. */
    readonly name: string
    /** The points it costs. */
    readonly pointsCost: number
    /** The cash value, in VND. */
    readonly valueVnd: number
}

/** One entry of the ledger of a customer. */
export interface LedgerRowView {
    /** The entry id. */
    readonly id: string
    /** Why the points moved. */
    readonly kind: LedgerKind
    /** The points added or taken. */
    readonly points: number
    /** The spend or the cash value behind the entry, in VND, or null. */
    readonly amountVnd: number | null
    /** The text that explains the entry, or empty. */
    readonly evidence: string
    /** Who moved the points. */
    readonly by: string
    /** When the points moved, ISO 8601. */
    readonly occurredAt: string
}

/** One reward of the catalogue. */
export interface RewardView {
    /** The reward id. */
    readonly id: string
    /** The name shown to customers. */
    readonly name: string
    /** What the reward gives. */
    readonly kind: RewardKind
    /** The cash value, in VND. */
    readonly valueVnd: number
    /** The discount percentage of a percent reward, or null. */
    readonly percent: number | null
    /** The points a redemption costs. */
    readonly pointsCost: number
    /** The units left, or null for unlimited. */
    readonly stock: number | null
    /** The most redemptions per customer, or null for unlimited. */
    readonly perCustomerLimit: number | null
    /** The lowest tier that may redeem it, or empty for any. */
    readonly minTierKey: string
    /** The note of the owner. */
    readonly note: string
    /** Whether customers may redeem it now. */
    readonly active: boolean
    /** The state in a word: `active` or `paused`. */
    readonly state: "active" | "paused"
}

/** The programme as the settings form draws it: the saved rules flat, and where customers see their points. */
export interface ProgramView {
    /** The name of the programme. */
    readonly name: string
    /** Whether the programme is on. */
    readonly enabled: boolean
    /** `active` while the programme is on, `paused` while it is off: the word the overview draws for it. */
    readonly state: "active" | "paused"
    /** The slug of the public points page. */
    readonly slug: string
    /** The path of the public points page. */
    readonly publicPath: string
    /** The points per thousand VND spent. */
    readonly perThousandVnd: number
    /** The points added to every visit. */
    readonly perVisit: number
    /** The smallest order that earns points, in VND. */
    readonly minOrderVnd: number
    /** The event that earns points: `payment` or `order`. */
    readonly trigger: string
    /** The months after which points expire, zero for never. */
    readonly expiryMonths: number
    /** The days before expiry at which the customer is warned. */
    readonly warnDays: number
    /** Whether the birthday gift is on. */
    readonly birthdayOn: boolean
    /** The bonus points of the birthday gift. */
    readonly birthdayPoints: number
    /** The key of the reward given with the gift, or empty. */
    readonly birthdayReward: string
    /** The note of the owner for the gift. */
    readonly birthdayNote: string
    /** The most promotions one customer receives in 30 days. */
    readonly maxPerMonth: number
    /** The earliest time of day a promotion goes out. */
    readonly hourFrom: string
    /** The latest time of day a promotion goes out. */
    readonly hourTo: string
    /** The most promotions sent in one tick. */
    readonly batch: number
}

/** One campaign as the promotions list draws it. */
export interface CampaignRowView {
    /** The campaign id. */
    readonly id: string
    /** The owner's campaign name. */
    readonly name: string
    /** Where the campaign stands. */
    readonly status: CampaignStatus
    /** The number of recipients. */
    readonly recipients: number
    /** Sent messages. */
    readonly sent: number
    /** Failed deliveries. */
    readonly failed: number
    /** The message that goes out, with customer placeholders retained. */
    readonly draft: string
    /** Who requested the campaign. */
    readonly createdBy: string
    /** When it was requested, ISO 8601. */
    readonly createdAt: string
}

/** The number of decisions that wait for a person, for the count on a tab. */
export interface PendingCount {
    /** How many decisions wait. */
    readonly count: number
}

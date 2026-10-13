import type { LoyaltyConfig, LoyaltyEarnRules } from "@modules/domain/loyalty-programs"
import type { LoyaltyReward, RedeemBlockCode, RewardEdit } from "@modules/domain/loyalty-rewards"
import type { MemberDetail } from "./loyalty.contracts"

/** Submitted earning rules before choosing the supported trigger. */
export interface ProgramEarnSubmission extends Omit<LoyaltyEarnRules, "trigger"> {
    /** The event selected by the owner. */
    readonly trigger: string
}

/** Submitted programme rules before normalization. */
export interface ProgramConfigSubmission extends Omit<LoyaltyConfig, "earn"> {
    /** The submitted earning rules. */
    readonly earn: ProgramEarnSubmission
}

/** Programme edits whose omitted or null fields preserve the saved value. */
export interface ProgramSubmission {
    /** The programme name when supplied. */
    readonly name?: string | null
    /** Whether the programme is enabled when supplied. */
    readonly enabled?: boolean | null
    /** All programme rules when supplied. */
    readonly config?: ProgramConfigSubmission | null
}

/** Reward edits before nullable limits and the kind are normalized. */
export interface RewardSubmission extends Omit<
    RewardEdit,
    "id" | "key" | "kind" | "percent" | "stock" | "perCustomerLimit" | "minTierKey"
> {
    /** The existing catalogue entry, absent when creating one. */
    readonly id?: string | null
    /** The requested catalogue key, absent to derive it from the name. */
    readonly key?: string | null
    /** The owner's selected reward kind. */
    readonly kind: string
    /** The percentage, absent for other kinds. */
    readonly percent?: number | null
    /** The stock, absent for unlimited. */
    readonly stock?: number | null
    /** The customer limit, absent for unlimited. */
    readonly perCustomerLimit?: number | null
    /** The minimum tier, absent for any tier. */
    readonly minTierKey?: string | null
}

/** Profile edits distinguish an omitted birthday from explicitly clearing it. */
export interface MemberSubmission {
    /** The customer to edit. */
    readonly customerId: string
    /** The replacement name when supplied. */
    readonly name?: string | null
    /** The replacement birthday; null clears it. */
    readonly birthday?: string | null
    /** The replacement note when supplied. */
    readonly note?: string | null
}

/** A refusal parameter represented by typed fields for a client. */
export interface RewardBlockParameter {
    /** The catalogue interpolation key. */
    readonly key: string
    /** The interpolation value rendered as text. */
    readonly value: string
}

/** A reward refusal represented by typed fields for a client. */
export interface RewardBlockView {
    /** The reason a reward cannot be redeemed. */
    readonly code: RedeemBlockCode
    /** The interpolation values for the reason. */
    readonly params: ReadonlyArray<RewardBlockParameter>
}

/** A reward refusal, or null when redemption is available. */
export type RewardBlockViewMatch = RewardBlockView | null

/** A reward and its typed refusal details. */
export interface RewardOptionView {
    /** The reward catalogue entry. */
    readonly reward: LoyaltyReward
    /** The refusal, or null. */
    readonly block: RewardBlockViewMatch
}

/** The member detail with refusal parameters represented by typed fields. */
export interface MemberDetailView extends Omit<MemberDetail, "rewards"> {
    /** The available catalogue entries and their refusal details. */
    readonly rewards: ReadonlyArray<RewardOptionView>
}

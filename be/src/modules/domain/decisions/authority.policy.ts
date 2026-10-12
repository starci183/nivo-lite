import type { AuthorityPatch, OptionalAuthorityProfile } from "./decisions.contracts"

/** The authority sheet as it is written: every field present. */
export interface AuthorityFields {
    /** The business policies. */
    readonly policies: string
    /** How replies are written. */
    readonly reply_style: string
    /** The brand voice. */
    readonly brand_voice: string
    /** What the agent must always ask about first. */
    readonly limits_note: string
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd: number | null
    /** The new-customer goal. */
    readonly goal_new_customers: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes: number | null
    /** Free note on the goals. */
    readonly goal_note: string
}

const nullableOf = (patch: number | null | undefined, current: number | null | undefined): number | null =>
    patch === undefined ? (current ?? null) : patch

/** The stored sheet (or an empty one) with the fields of the patch laid over it; a goal set to null clears it. */
export const mergeAuthority = (current: OptionalAuthorityProfile, patch: AuthorityPatch): AuthorityFields => ({
    policies: patch.policies ?? current?.policies ?? "",
    reply_style: patch.reply_style ?? current?.reply_style ?? "",
    brand_voice: patch.brand_voice ?? current?.brand_voice ?? "",
    limits_note: patch.limits_note ?? current?.limits_note ?? "",
    goal_revenue_vnd: nullableOf(patch.goal_revenue_vnd, current?.goal_revenue_vnd),
    goal_new_customers: nullableOf(patch.goal_new_customers, current?.goal_new_customers),
    goal_first_reply_minutes: nullableOf(patch.goal_first_reply_minutes, current?.goal_first_reply_minutes),
    goal_note: patch.goal_note ?? current?.goal_note ?? "",
})

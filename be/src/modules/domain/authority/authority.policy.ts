import type { AuthorityFields, AuthorityPatch, OptionalAuthorityProfile } from "./authority.contracts"

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

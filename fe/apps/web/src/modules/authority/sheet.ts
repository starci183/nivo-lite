import { EMPTY_PROFILE, authorityModeOf } from "./rules"
import type { AuthorityProfile, AuthoritySheet } from "./rules"

/** The back end profile line. */
interface ProfileWire {
    readonly goal_revenue_vnd?: number | null
    readonly goal_new_customers?: number | null
    readonly goal_first_reply_minutes?: number | null
    readonly goal_note: string
    readonly policies: string
    readonly reply_style: string
    readonly brand_voice: string
    readonly limits_note: string
}

/** The back end rule line. */
interface RuleWire {
    readonly department: string
    readonly action: string
    readonly mode: string
    readonly limit_vnd?: number | null
    readonly required_fields: ReadonlyArray<string>
}

/** The back end `authority` answer. */
interface SheetWire {
    readonly profile?: ProfileWire | null
    readonly rules: ReadonlyArray<RuleWire>
}

/** A back end profile as the page uses it. */
const toProfile = (wire: ProfileWire | null | undefined): AuthorityProfile => {
    if (wire === null || wire === undefined) return EMPTY_PROFILE
    return {
        goalRevenue: wire.goal_revenue_vnd ?? null,
        goalCustomers: wire.goal_new_customers ?? null,
        goalReply: wire.goal_first_reply_minutes ?? null,
        goalNote: wire.goal_note,
        policies: wire.policies,
        replyStyle: wire.reply_style,
        brandVoice: wire.brand_voice,
        limitsNote: wire.limits_note,
    }
}

/** The back end authority sheet as the page uses it: a mode outside the closed set reads as "ask first". */
export const toAuthoritySheet = (wire: SheetWire): AuthoritySheet => ({
    profile: toProfile(wire.profile),
    rules: wire.rules.map((rule) => ({
        department: rule.department,
        action: rule.action,
        mode: authorityModeOf(rule.mode) ?? "ask",
        limit: rule.limit_vnd ?? null,
        required: rule.required_fields,
    })),
})

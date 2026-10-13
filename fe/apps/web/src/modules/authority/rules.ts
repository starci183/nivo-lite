import { MODULE_KEYS, MODULE_REGISTRY, actionDef } from "@/modules/catalog"
import type { ActionKey, ModuleKey } from "@/modules/catalog"

/** How far an action may run without a person. */
export type AuthorityMode = "auto" | "ask" | "never"

/** The three modes, in display order. */
export const MODES: ReadonlyArray<AuthorityMode> = ["auto", "ask", "never"]

/** The mode a text names, or none. */
export const authorityModeOf = (value: string): AuthorityMode | null => MODES.find((mode) => mode === value) ?? null

/** Details an action can require before NIVO acts alone. */
export const FIELD_KEYS = ["contact_name", "need", "contact", "customer", "items", "amount_vnd"] as const

/** One department and the actions it can be granted, in display order. */
export interface RuleGroup {
    readonly department: ModuleKey
    readonly actions: ReadonlyArray<ActionKey>
}

/** Departments and the actions each one can be granted, from the module catalog. */
const RULE_MATRIX: ReadonlyArray<RuleGroup> = MODULE_KEYS.map((department) => ({
    department,
    actions: MODULE_REGISTRY[department].authorityActions.map((entry) => entry.action),
}))

/** Actions where a VND limit is meaningful. */
const AMOUNT_ACTIONS: ReadonlyArray<ActionKey> = MODULE_KEYS.flatMap((department) =>
    MODULE_REGISTRY[department].authorityActions.filter((entry) => entry.amountLimit).map((entry) => entry.action),
)

/** Does a VND limit mean something for this action? */
export const hasAmountLimit = (action: ActionKey): boolean => AMOUNT_ACTIONS.includes(action)

/** The modes an action may be set to: an action the catalog caps at "ask" (publishing) can never run alone. */
export const modesFor = (action: ActionKey): ReadonlyArray<AuthorityMode> =>
    actionDef(action).maxMode === null ? MODES : MODES.filter((mode) => mode !== "auto")

/** One stored rule as the page uses it. */
export interface StoredRule {
    readonly department: string
    readonly action: string
    readonly mode: AuthorityMode
    readonly limit: number | null
    readonly required: ReadonlyArray<string>
}

/** The stored goals, policies and limits note; empty text and no numbers before anything is saved. */
export interface AuthorityProfile {
    readonly goalRevenue: number | null
    readonly goalCustomers: number | null
    readonly goalReply: number | null
    readonly goalNote: string
    readonly policies: string
    readonly replyStyle: string
    readonly brandVoice: string
    readonly limitsNote: string
}

/** What the authority page edits: the profile and every stored rule. */
export interface AuthoritySheet {
    readonly profile: AuthorityProfile
    readonly rules: ReadonlyArray<StoredRule>
}

/** The profile before anything was saved. */
export const EMPTY_PROFILE: AuthorityProfile = {
    goalRevenue: null,
    goalCustomers: null,
    goalReply: null,
    goalNote: "",
    policies: "",
    replyStyle: "",
    brandVoice: "",
    limitsNote: "",
}

/** The groups to show: the stable modules always, any other module once its rules exist (installing a module adds them). */
export const visibleGroups = (rules: ReadonlyArray<StoredRule>): ReadonlyArray<RuleGroup> =>
    RULE_MATRIX.filter(
        (group) =>
            MODULE_REGISTRY[group.department].status === "stable" ||
            rules.some((rule) => rule.department === group.department),
    )

/** Editable slice of a rule. */
export interface RuleDraft {
    readonly mode: AuthorityMode
    readonly limit: number | null
    readonly required: ReadonlyArray<string>
}

/** Key of a rule in draft maps. */
export const ruleKey = (department: ModuleKey, action: ActionKey): string => `${department}/${action}`

/** Draft map from stored rules; an action without a stored rule starts as "ask first". */
export const draftsFrom = (rules: ReadonlyArray<StoredRule>): Record<string, RuleDraft> =>
    Object.fromEntries(
        RULE_MATRIX.flatMap((group) =>
            group.actions.map((action): [string, RuleDraft] => {
                const rule = rules.find((one) => one.department === group.department && one.action === action)
                return [
                    ruleKey(group.department, action),
                    { mode: rule?.mode ?? "ask", limit: rule?.limit ?? null, required: rule?.required ?? [] },
                ]
            }),
        ),
    )

/** One rule to write: the action and the three values the back end keeps. */
export interface RuleChange {
    readonly action: ActionKey
    readonly mode: AuthorityMode
    readonly limit: number | null
    readonly required: ReadonlyArray<string>
}

/** Which slice of a rule an edit touches: the mode with its limit, or the required details. */
type RuleSlice = "scope" | "required"

/** The rules whose edited slice differs from the stored one; each keeps the other slice as stored. */
export const ruleChanges = (
    stored: Record<string, RuleDraft>,
    draft: Record<string, RuleDraft>,
    slice: RuleSlice,
): ReadonlyArray<RuleChange> =>
    RULE_MATRIX.flatMap((group) =>
        group.actions.flatMap((action) => {
            const key = ruleKey(group.department, action)
            const before = stored[key]
            const after = draft[key]
            if (before === undefined || after === undefined) return []
            const next =
                slice === "scope"
                    ? { ...before, mode: after.mode, limit: after.limit }
                    : { ...before, required: after.required }
            const same =
                slice === "scope"
                    ? before.mode === after.mode && before.limit === after.limit
                    : before.required.join() === after.required.join()
            return same ? [] : [{ action, mode: next.mode, limit: next.limit, required: next.required }]
        }),
    )

/** Number field value: empty is NaN. */
export const toField = (value: number | null): number => (value === null ? Number.NaN : value)

/** Number from a number field: NaN means empty. */
export const fromField = (value: number): number | null => (Number.isFinite(value) ? value : null)

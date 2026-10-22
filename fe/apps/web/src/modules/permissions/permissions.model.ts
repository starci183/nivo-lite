import type { ApprovalPolicy, ApproverRole, AuthorityMode, RuleUnit, StoredRule } from "@/modules/authority"

/** How the mode of a rule reads on the table and in the drawer. */
export type ModeKind = "auto" | "auto-up-to" | "ask-band" | "ask" | "never"

/** The auto and ask bounds of a rule, in its unit; null leaves that edge out. */
export interface Bands {
    readonly auto: number | null
    readonly ask: number | null
}

/** What the drawer lets the owner choose as the strategy of a rule. */
export type Strategy = "auto" | "bands" | "ask" | "never"

/** Everything the drawer edits about one rule, as typed (a number field is NaN while empty). */
export interface PermissionDraft {
    readonly department: string
    readonly action: string
    readonly strategy: Strategy
    readonly unit: RuleUnit
    readonly autoMax: number
    readonly askMax: number
    readonly agents: ReadonlyArray<string>
    readonly roles: ReadonlyArray<ApproverRole>
    readonly rooms: ReadonlyArray<string>
    readonly members: ReadonlyArray<string>
    readonly policy: ApprovalPolicy
    readonly timeoutMinutes: number
}

/** One member's approval limit as the drawer edits it: blank limit (NaN) is no limit. */
export interface GrantDraft {
    readonly memberId: string
    readonly enabled: boolean
    readonly max: number
}

/** The rule as the back end takes it: what the save sends. */
export interface PermissionChange {
    readonly department: string
    readonly action: string
    readonly mode: AuthorityMode
    readonly unit: RuleUnit
    readonly autoMax: number | null
    readonly askMax: number | null
    readonly agents: ReadonlyArray<string>
    readonly roles: ReadonlyArray<ApproverRole>
    readonly rooms: ReadonlyArray<string>
    readonly members: ReadonlyArray<string>
    readonly policy: ApprovalPolicy
    readonly timeoutMinutes: number
}

/** The times a request may wait, in minutes. */
export const TIMEOUT_CHOICES: ReadonlyArray<number> = [5, 15, 30, 60, 120, 720, 1440]

/** The largest bound the slider offers: 100 for a percentage, 50 for a count. */
export const SLIDER_MAX: Readonly<Record<RuleUnit, number>> = { vnd: 0, percent: 100, count: 50 }

/**
 * The bands of a rule. A rule saved with bands has them; an older rule that runs alone strictly below a VND limit has the band
 * "up to the limit minus one"; every other rule has none.
 */
export const bandsOf = (rule: StoredRule): Bands => {
    if (rule.autoMax !== null || rule.askMax !== null) return { auto: rule.autoMax, ask: rule.askMax }
    if (rule.mode === "auto" && rule.unit === "vnd" && rule.limit !== null && rule.limit > 0) {
        return { auto: rule.limit - 1, ask: null }
    }
    return { auto: null, ask: null }
}

/** How the mode of the rule reads: never, up to an amount alone, an ask band, plain ask, or plain auto. */
export const modeKindOf = (rule: StoredRule): ModeKind => {
    if (rule.mode === "never") return "never"
    const bands = bandsOf(rule)
    if (bands.auto !== null && bands.ask === null) return "auto-up-to"
    if (bands.auto !== null || bands.ask !== null) return "ask-band"
    return rule.mode === "auto" ? "auto" : "ask"
}

/** The strategy the drawer starts from for a rule. */
export const strategyOf = (rule: StoredRule): Strategy => {
    const kind = modeKindOf(rule)
    if (kind === "auto-up-to" || kind === "ask-band") return "bands"
    return kind
}

/** True when a rule asks a person, so its group, policy and time matter. */
export const asksPerson = (rule: StoredRule): boolean => rule.mode !== "never" && modeKindOf(rule) !== "auto"

/** The ids of a multiple choice after a change, in the order they were picked: kept ones stay in place, new ones come last. */
export const orderedPick = (current: ReadonlyArray<string>, next: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...current.filter((id) => next.includes(id)),
    ...next.filter((id) => !current.includes(id)),
]

/** The draft the drawer opens with for a rule. */
export const draftOf = (rule: StoredRule): PermissionDraft => {
    const bands = bandsOf(rule)
    return {
        department: rule.department,
        action: rule.action,
        strategy: strategyOf(rule),
        unit: rule.unit,
        autoMax: bands.auto ?? Number.NaN,
        askMax: bands.ask ?? Number.NaN,
        agents: rule.agents,
        roles: rule.roles,
        rooms: rule.rooms,
        members: rule.members,
        policy: rule.policy,
        timeoutMinutes: rule.timeoutMinutes,
    }
}

const numberOrNull = (value: number): number | null => (Number.isFinite(value) ? value : null)

/** True when the bands typed are enough to save: a band strategy needs at least one bound, and the auto bound may not pass the ask bound. */
export const bandsValid = (draft: PermissionDraft): boolean => {
    if (draft.strategy !== "bands") return true
    const auto = numberOrNull(draft.autoMax)
    const ask = numberOrNull(draft.askMax)
    if (auto === null && ask === null) return false
    return auto === null || ask === null || auto <= ask
}

/** What the strategy chosen becomes on the wire: the mode, and the two bounds (cleared unless it is a band strategy). */
export const changeOf = (draft: PermissionDraft): PermissionChange => {
    const banded = draft.strategy === "bands"
    return {
        department: draft.department,
        action: draft.action,
        mode: draft.strategy === "bands" ? "ask" : draft.strategy,
        unit: banded ? draft.unit : "vnd",
        autoMax: banded ? numberOrNull(draft.autoMax) : null,
        askMax: banded ? numberOrNull(draft.askMax) : null,
        agents: draft.agents,
        roles: draft.roles,
        rooms: draft.rooms,
        members: draft.members,
        policy: draft.policy,
        timeoutMinutes: draft.timeoutMinutes,
    }
}

/** The approval limit field of a member: NaN while blank, which is no limit. */
export const grantMax = (grant: GrantDraft): number | null => numberOrNull(grant.max)

/** The rule of an action nobody saved yet: ask first, an owner or a manager approves, any one of them, thirty minutes. */
export const defaultRule = (department: string, action: string): StoredRule => ({
    department,
    action,
    mode: "ask",
    limit: null,
    required: [],
    unit: "vnd",
    autoMax: null,
    askMax: null,
    agents: [],
    roles: ["owner", "manager"],
    rooms: [],
    members: [],
    policy: "any",
    timeoutMinutes: 30,
})

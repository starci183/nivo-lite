import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { APPROVAL_POLICIES, MAX_TIMEOUT_MINUTES, RULE_UNITS } from "./authority-rules.contracts"
import type {
    JudgedChange,
    OptionalRuleAgent,
    RuleAgentList,
    RuleChange,
    RuleMode,
    RuleSettingsPatch,
} from "./authority-rules.contracts"
import { AuthorityRulesErrorCode } from "./errors/authority-rules.error"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROOM_KEY = /^[a-z][a-z0-9_-]{0,39}$/
const ROLES: ReadonlySet<string> = new Set(["owner", "manager", "staff"])
const PERCENT_MAX = 100

const unique = <T>(values: ReadonlyArray<T>): Array<T> =>
    values.filter((value, index) => values.indexOf(value) === index)

const isBound = (value: number | null | undefined): value is number => typeof value === "number"

/** True when a number is a legal band bound for the unit: not negative, at most 100 for a percentage, whole for a count. */
const legalBound = (value: number, unit: string): boolean =>
    Number.isFinite(value) &&
    value >= 0 &&
    (unit !== "percent" || value <= PERCENT_MAX) &&
    (unit !== "count" || Number.isInteger(value))

/** True when the bands, given as a pair, are legal for the unit and the auto band does not exceed the ask band. */
const bandsLegal = (auto: number | null | undefined, ask: number | null | undefined, unit: string): boolean =>
    (!isBound(auto) || legalBound(auto, unit)) &&
    (!isBound(ask) || legalBound(ask, unit)) &&
    (!isBound(auto) || !isBound(ask) || auto <= ask)

/** The saved bands come as a pair: naming one bound and leaving the other out would leave the order unchecked. */
const bandsComplete = (change: RuleChange): boolean =>
    (change.auto_max === undefined) === (change.ask_max === undefined)

const timeoutLegal = (minutes: number): boolean =>
    Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_TIMEOUT_MINUTES

const groupLegal = (change: RuleChange): boolean =>
    (change.approver_roles ?? []).every((role) => ROLES.has(role)) &&
    (change.approver_rooms ?? []).every((room) => ROOM_KEY.test(room)) &&
    (change.approver_members ?? []).every((member) => UUID.test(member))

const settingsOf = (change: RuleChange): RuleSettingsPatch => ({
    ...(change.unit === undefined ? {} : { unit: change.unit }),
    ...(change.auto_max === undefined ? {} : { auto_max: change.auto_max, ask_max: change.ask_max }),
    ...(change.approver_roles === undefined ? {} : { approver_roles: unique(change.approver_roles) }),
    ...(change.approver_rooms === undefined ? {} : { approver_rooms: unique(change.approver_rooms) }),
    ...(change.approver_members === undefined ? {} : { approver_members: unique(change.approver_members) }),
    ...(change.approval_policy === undefined ? {} : { approval_policy: change.approval_policy }),
    ...(change.timeout_minutes === undefined ? {} : { timeout_minutes: change.timeout_minutes }),
    ...(change.agents === undefined ? {} : { agents: unique(change.agents) }),
})

/** The mode a rule with bands stores: it follows them ("auto" when there is an auto band, else "ask"); "never" stays "never". */
const modeWithBands = (change: RuleChange, banded: boolean): RuleMode => {
    if (!banded || change.mode === "never") return change.mode
    return isBound(change.auto_max) ? "auto" : "ask"
}

/**
 * Judges a rule a manager saves. The approval settings are checked (unit, bands, policy, time, group, agents); the mode follows
 * the bands when there are some; the legacy VND limit is dropped when bands or a unit other than VND say it better. A settings
 * field the change leaves out stays out of the patch, so it keeps what the table holds.
 */
export const judgeChange = (change: RuleChange): Outcome<JudgedChange, AuthorityRulesErrorCode> => {
    const unit = change.unit ?? "vnd"
    if (!RULE_UNITS.includes(unit)) return refused(AuthorityRulesErrorCode.InvalidUnit, { unit })
    if (!bandsComplete(change) || !bandsLegal(change.auto_max, change.ask_max, unit)) {
        return refused(AuthorityRulesErrorCode.InvalidBands)
    }
    if (change.approval_policy !== undefined && !APPROVAL_POLICIES.includes(change.approval_policy)) {
        return refused(AuthorityRulesErrorCode.InvalidPolicy, { policy: change.approval_policy })
    }
    if (change.timeout_minutes !== undefined && !timeoutLegal(change.timeout_minutes)) {
        return refused(AuthorityRulesErrorCode.InvalidTimeout)
    }
    if (!groupLegal(change)) return refused(AuthorityRulesErrorCode.InvalidGroup)
    if ((change.agents ?? []).some((agent) => !UUID.test(agent))) return refused(AuthorityRulesErrorCode.InvalidAgents)
    const banded = isBound(change.auto_max) || isBound(change.ask_max)
    return ok({
        mode: modeWithBands(change, banded),
        limit_vnd: banded || unit !== "vnd" ? null : change.limit_vnd,
        settings: settingsOf(change),
    })
}

/** True when a rule applies to the agent: no agent named (a human or system caller), a rule listing no agents, or one that lists it. */
export const appliesToAgent = (agents: RuleAgentList, agentId: OptionalRuleAgent): boolean =>
    agentId === null || agents === undefined || agents.length === 0 || agents.includes(agentId)

import type { Proposal, ProposalFieldValue, ReasonCode } from "@modules/domain/work-items"
import type {
    AuthorityRule,
    GateInput,
    GateVerdict,
    OptionalAmount,
    OptionalAmountVnd,
    OptionalAuthorityRule,
    OptionalBand,
    RuleBounds,
    RuleMode,
    RuleUnit,
} from "./authority-rules.contracts"

/** The confidence below which the engine treats its own result as unclear. */
export const MIN_CONFIDENCE = 0.6

/**
 * Limit semantics: `limit_vnd` is the amount the action runs by itself strictly BELOW. `amount >= limit_vnd` asks a person
 * (over_authority); a missing limit means no amount limit, a missing amount never exceeds a limit.
 */
export const isOverLimit = (limitVnd: OptionalAmountVnd, amountVnd: OptionalAmountVnd): boolean =>
    typeof limitVnd === "number" && typeof amountVnd === "number" && amountVnd >= limitVnd

/**
 * The amount of a proposal in the unit of its rule: VND is the proposal's own `amount_vnd`, a percentage is the number field
 * `amount_percent`, a count is the number field `amount_count`; null when the proposal carries none.
 */
export const ruleAmountOf = (proposal: Proposal, unit: RuleUnit): OptionalAmount => {
    const value =
        unit === "vnd" ? proposal.amount_vnd : proposal.fields[unit === "percent" ? "amount_percent" : "amount_count"]
    return typeof value === "number" ? value : null
}

/** True when the rule has bands: an auto bound or an ask bound. A rule without them keeps the old mode and limit behaviour. */
export const hasBands = (rule: RuleBounds): boolean => rule.auto_max != null || rule.ask_max != null

/**
 * The band an amount falls in: up to `auto_max` (inclusive) the action runs alone, above it up to `ask_max` (inclusive) a person
 * is asked, above that it never runs; a missing bound leaves out that edge. Null when the rule has no bands, and the rule's own
 * mode when the proposal carries no amount to place.
 */
export const bandOf = (rule: RuleBounds, amount: OptionalAmount): OptionalBand => {
    if (!hasBands(rule)) return null
    if (amount === null) return rule.mode
    if (rule.auto_max != null && amount <= rule.auto_max) return "auto"
    return rule.ask_max == null || amount <= rule.ask_max ? "ask" : "never"
}

const isEmpty = (value: ProposalFieldValue | undefined): boolean =>
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")

/** The value of a required field: `amount_vnd` may live on the proposal itself or in its fields. */
const fieldValue = (proposal: Proposal, field: string): ProposalFieldValue | undefined =>
    field === "amount_vnd" ? (proposal.amount_vnd ?? proposal.fields.amount_vnd) : proposal.fields[field]

/** The required fields of the rule that the proposal does not have yet. */
export const missingFields = (rule: OptionalAuthorityRule, proposal: Proposal): ReadonlyArray<string> =>
    (rule?.required_fields ?? []).filter((field) => isEmpty(fieldValue(proposal, field)))

const withCap = (rule: AuthorityRule | null, cap: RuleMode | null): AuthorityRule | null =>
    rule !== null && rule.mode === "auto" && cap !== null ? { ...rule, mode: cap } : rule

/** True when the rule asks a person for this amount: its band says ask, or, without bands, the amount reaches the old limit. */
const asksForAmount = (rule: AuthorityRule, band: OptionalBand, amount: OptionalAmount): boolean => {
    if (band !== null) return band === "ask"
    return (rule.unit ?? "vnd") === "vnd" && isOverLimit(rule.limit_vnd, amount)
}

const reasonsOf = (input: GateInput, rule: AuthorityRule | null, missing: ReadonlyArray<string>): Array<ReasonCode> => {
    const { proposal, humanApproved = false } = input
    const amount = rule === null ? null : ruleAmountOf(proposal, rule.unit ?? "vnd")
    const band = rule === null ? null : bandOf(rule, amount)
    const lowConfidence = typeof proposal.confidence === "number" && proposal.confidence < MIN_CONFIDENCE
    const badCandidates = Array.isArray(proposal.candidates) && proposal.candidates.length !== 1
    const checks: ReadonlyArray<readonly [boolean, ReasonCode]> = [
        [rule === null || rule.mode === "never" || band === "never", "not_allowed"],
        [missing.length > 0, "missing_data"],
        [!humanApproved && rule !== null && asksForAmount(rule, band, amount), "over_authority"],
        [lowConfidence || proposal.outcome === "unclear" || badCandidates, "unclear_outcome"],
        [!humanApproved && rule !== null && rule.mode === "ask", "over_authority"],
    ]
    return checks
        .filter(([hit]) => hit)
        .map(([, reason]) => reason)
        .filter((reason, index, all) => all.indexOf(reason) === index)
}

/**
 * The gate. Checks in precedence order, every reason collected, the first one is `reason`:
 * 1 not_allowed (no rule, never, or an amount above the ask band), 2 missing_data, 3 over_authority (amount in the ask band, or at or over the old limit),
 * 4 unclear_outcome (low confidence, an unclear outcome, or not exactly one candidate), 5 over_authority (mode ask).
 * `humanApproved` skips 3 and 5 but never 2: approving cannot supply missing data. It must only be passed for the SAME
 * work item the person decided on: an approval never carries over to another action or module. An action the registry caps
 * at "ask" (publishing) never runs alone, whatever a stored rule says.
 */
export const evaluateGate = (input: GateInput): GateVerdict => {
    const rule = withCap(input.rule, input.maxMode)
    const missing = missingFields(rule, input.proposal)
    const reasons = reasonsOf(input, rule, missing)
    const [first] = reasons
    if (first === undefined) return { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] }
    return { verdict: "ask", reason: first, reasons, missing }
}

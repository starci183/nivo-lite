import type {
    AuthorityRule,
    GateInput,
    GateVerdict,
    OptionalAuthorityRule,
    Proposal,
    ProposalFieldValue,
    ReasonCode,
    RuleMode,
} from "./decisions.contracts"
import type { OptionalNumber } from "./decisions-views.contracts"

/** The confidence below which the engine treats its own result as unclear. */
export const MIN_CONFIDENCE = 0.6

/**
 * Limit semantics: `limit_vnd` is the amount the action runs by itself strictly BELOW. `amount >= limit_vnd` asks a person
 * (over_authority); a missing limit means no amount limit, a missing amount never exceeds a limit.
 */
export const isOverLimit = (limitVnd: OptionalNumber, amountVnd: OptionalNumber): boolean =>
    typeof limitVnd === "number" && typeof amountVnd === "number" && amountVnd >= limitVnd

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

const reasonsOf = (input: GateInput, rule: AuthorityRule | null, missing: ReadonlyArray<string>): Array<ReasonCode> => {
    const { proposal, humanApproved = false } = input
    const amount = typeof proposal.amount_vnd === "number" ? proposal.amount_vnd : null
    const lowConfidence = typeof proposal.confidence === "number" && proposal.confidence < MIN_CONFIDENCE
    const badCandidates = Array.isArray(proposal.candidates) && proposal.candidates.length !== 1
    const checks: ReadonlyArray<readonly [boolean, ReasonCode]> = [
        [rule === null || rule.mode === "never", "not_allowed"],
        [missing.length > 0, "missing_data"],
        [!humanApproved && rule !== null && isOverLimit(rule.limit_vnd, amount), "over_authority"],
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
 * 1 not_allowed (no rule or never), 2 missing_data, 3 over_authority (amount at or over the limit),
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

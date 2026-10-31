import type { GateVerdict } from "@modules/domain/authority-rules"
import type { ReasonCode } from "@modules/domain/work-items"
import type { BranchAction, DecidePoint, FactRegistry, FactValues, GraphBranch } from "../agent-graphs.contracts"
import { evaluate } from "./condition.policy"

const uniqueReasons = (reasons: ReadonlyArray<ReasonCode>): ReadonlyArray<ReasonCode> =>
    reasons.filter((reason, index) => reasons.indexOf(reason) === index)

const asking = (gate: GateVerdict, reason: ReasonCode): GateVerdict => ({
    verdict: "ask",
    reason,
    reasons: uniqueReasons([reason, ...gate.reasons.filter((other) => other !== "routine")]),
    missing: gate.missing,
})

/**
 * The stricter of the gate and the branch. A branch `auto` never loosens the gate. A branch `ask` under a gate that runs alone
 * asks on the branch approver with the reason `branch_ask`; under a gate that asks it keeps the gate reason when that is a
 * harder one (missing data, not allowed, unclear), else it is `branch_ask` too, so the named approver is the one asked. A branch
 * `stop` asks with the reason `not_allowed`, as a closed rule answers.
 */
export const strictest = (gate: GateVerdict, then: BranchAction): GateVerdict => {
    if (then === "stop") return asking(gate, "not_allowed")
    if (then === "auto") return gate
    const hard = gate.verdict === "ask" && gate.reason !== "over_authority"
    return asking(gate, hard ? gate.reason : "branch_ask")
}

/** The branch that matches: the first whose condition holds. A fact that could not be read takes the `else`, and an `else` never runs alone. */
export const pickBranch = (decide: DecidePoint, facts: FactValues, registry: FactRegistry): GraphBranch | null => {
    const unread = decide.facts.some((fact) => facts[fact] === undefined)
    const fallback = decide.branches.find((branch) => branch.when === "else") ?? null
    const matched = unread
        ? fallback
        : (decide.branches.find((branch) => branch.when !== "else" && evaluate(branch.when, facts, registry)) ??
          fallback)
    if (matched === null) return null
    return matched.when === "else" && matched.then === "auto" ? { ...matched, then: "ask" } : matched
}

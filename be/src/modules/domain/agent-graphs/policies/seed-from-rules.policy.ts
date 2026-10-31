import type { BranchApprover, Condition, GraphBranch, GraphSource } from "../agent-graphs.contracts"
import type { SeedRule } from "../agent-graphs.seed"

/** The keys of the nodes a seeded decide point leads to. */
export interface SeedTargets {
    /** Where a branch that runs alone goes. */
    readonly auto: string
    /** Where a branch that asks goes. */
    readonly ask: string
    /** Where a branch that stops goes. */
    readonly stop: string
}

/** The approver the rule names, with the rule's policy and wait; after the wait the request goes to the agent's owner, as it does today. */
export const approverOfRule = (rule: SeedRule): BranchApprover => ({
    group: { roles: rule.approver_roles, rooms: rule.approver_rooms, members: rule.approver_members },
    policy: rule.approval_policy,
    timeoutMinutes: rule.timeout_minutes,
    onTimeout: { kind: "agent_owner" },
})

const branch = (
    key: string,
    when: Condition | "else",
    then: GraphBranch["then"],
    targets: SeedTargets,
    rule: SeedRule,
): GraphBranch => {
    const sources: ReadonlyArray<GraphSource> = [{ kind: "rule", action: rule.action }]
    return {
        key,
        when,
        then,
        next: targets[then],
        approver: then === "ask" ? approverOfRule(rule) : null,
        sources,
    }
}

/** The condition "above a and up to b", both inclusive on the top and open at the bottom, as the gate's bands read. */
const between = (fact: string, above: number | null, upTo: number | null): Condition => {
    const low: ReadonlyArray<Condition> = above === null ? [] : [{ fact, op: "gt", value: above }]
    const high: ReadonlyArray<Condition> = upTo === null ? [] : [{ fact, op: "lte", value: upTo }]
    const parts = [...low, ...high]
    return parts.length === 1 && parts[0] !== undefined ? parts[0] : { all: parts }
}

const bandBranches = (rule: SeedRule, fact: string, targets: SeedTargets): ReadonlyArray<GraphBranch> => {
    const { auto_max: autoMax, ask_max: askMax } = rule
    const auto = autoMax === null ? [] : [branch("auto", { fact, op: "lte", value: autoMax }, "auto", targets, rule)]
    const ask = askMax === null ? [] : [branch("ask", between(fact, autoMax, askMax), "ask", targets, rule)]
    // Above the ask band the action never runs; with no ask bound everything above the auto band asks.
    return [...auto, ...ask, branch("else", "else", askMax === null ? "ask" : "stop", targets, rule)]
}

/**
 * The branches a rule becomes, so a seeded graph answers what the gate answers: bands turn into `lte` and `gt` terms (the gate's
 * `auto_max` is inclusive), the old `limit_vnd` into `lt` (strictly below), a mode `ask` into one `else` that asks and `never`
 * into one that stops. A rule that runs alone with no limit runs alone on any amount that could be read, and asks on one that
 * could not, because an `else` may never run alone. The approver, policy and wait of the rule go to every branch that asks.
 */
export const branchesFromRule = (rule: SeedRule, fact: string, targets: SeedTargets): ReadonlyArray<GraphBranch> => {
    if (rule.mode === "never") return [branch("else", "else", "stop", targets, rule)]
    if (rule.auto_max !== null || rule.ask_max !== null) return bandBranches(rule, fact, targets)
    if (rule.mode === "ask") return [branch("else", "else", "ask", targets, rule)]
    const when: Condition = rule.limit_vnd === null ? { fact, op: "known" } : { fact, op: "lt", value: rule.limit_vnd }
    return [branch("auto", when, "auto", targets, rule), branch("else", "else", "ask", targets, rule)]
}

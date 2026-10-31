import { MAX_CONDITION_DEPTH, MAX_CONDITION_TERMS } from "../agent-graphs.contracts"
import type { Condition, FactRegistry, FactSpec, FactValue, FactValues, Say } from "../agent-graphs.contracts"

type Comparison = Extract<Condition, { readonly fact: string }>

/** True for a branch of the tree that groups other conditions. */
const isGroup = (
    condition: Condition,
): condition is Extract<Condition, { readonly all: unknown } | { readonly any: unknown }> =>
    "all" in condition || "any" in condition

const membersOf = (condition: Condition): ReadonlyArray<Condition> => {
    if ("all" in condition) return condition.all
    if ("any" in condition) return condition.any
    return []
}

/** How many comparisons the tree holds. */
export const termCount = (condition: Condition): number =>
    isGroup(condition) ? membersOf(condition).reduce((sum, member) => sum + termCount(member), 0) : 1

/** How deep the groups nest: a bare comparison is 0, a group of comparisons is 1. */
export const conditionDepth = (condition: Condition): number =>
    isGroup(condition) ? 1 + Math.max(0, ...membersOf(condition).map(conditionDepth)) : 0

const typeOf = (value: FactValue): FactSpec["type"] => {
    if (typeof value === "number") return "number"
    return typeof value === "boolean" ? "boolean" : "string"
}

const ORDERED: ReadonlySet<string> = new Set(["lt", "lte", "gt", "gte"])

/** The reason a comparison does not fit its fact, or null when it does. */
const comparisonProblem = (term: Comparison, registry: FactRegistry): string | null => {
    const spec = registry[term.fact]
    if (spec === undefined) return `unknown_fact:${term.fact}`
    if (term.op === "known") return null
    if (term.op === "in") {
        const fits =
            spec.type === "string" &&
            term.value.every((item) => spec.allowed === undefined || spec.allowed.includes(item))
        return fits ? null : `wrong_value:${term.fact}`
    }
    if (typeOf(term.value) !== spec.type) return `wrong_type:${term.fact}`
    if (ORDERED.has(term.op) && spec.type !== "number") return `wrong_op:${term.fact}`
    if (spec.allowed !== undefined && typeof term.value === "string" && !spec.allowed.includes(term.value))
        return `wrong_value:${term.fact}`
    return null
}

const termsOf = (condition: Condition): ReadonlyArray<Comparison> =>
    "fact" in condition ? [condition] : membersOf(condition).flatMap(termsOf)

/**
 * Everything wrong with a condition against the registry: depth and term limits, a fact nobody declared, a value of the wrong
 * type or outside the allowed ones, an ordering on something that is not a number. Empty means the tree may be saved and run.
 */
export const conditionProblems = (condition: Condition, registry: FactRegistry): ReadonlyArray<string> => {
    const shape = [
        ...(conditionDepth(condition) > MAX_CONDITION_DEPTH ? ["too_deep"] : []),
        ...(termCount(condition) > MAX_CONDITION_TERMS ? ["too_many_terms"] : []),
        ...(isGroup(condition) && membersOf(condition).length === 0 ? ["empty_group"] : []),
    ]
    const terms = termsOf(condition).flatMap((term) => {
        const problem = comparisonProblem(term, registry)
        return problem === null ? [] : [problem]
    })
    return [...shape, ...terms]
}

const compare = (term: Comparison, actual: FactValue): boolean => {
    if (term.op === "known") return true
    if (term.op === "in") return typeof actual === "string" && term.value.includes(actual)
    if (term.op === "eq") return actual === term.value
    if (term.op === "neq") return actual !== term.value
    if (typeof actual !== "number" || typeof term.value !== "number") return false
    if (term.op === "lt") return actual < term.value
    if (term.op === "lte") return actual <= term.value
    return term.op === "gt" ? actual > term.value : actual >= term.value
}

/**
 * Whether the facts satisfy the condition. A fact that could not be read satisfies nothing but a missing `known`, and a value of
 * the wrong type satisfies nothing, so a bad read can only fall through to the `else`.
 */
export const evaluate = (condition: Condition, facts: FactValues, registry: FactRegistry): boolean => {
    if (conditionProblems(condition, registry).length > 0) return false
    return holds(condition, facts)
}

const holds = (condition: Condition, facts: FactValues): boolean => {
    if ("all" in condition) return condition.all.every((member) => holds(member, facts))
    if ("any" in condition) return condition.any.some((member) => holds(member, facts))
    const actual = facts[condition.fact]
    return actual === undefined ? false : compare(condition, actual)
}

/** An amount in dong as a shop owner says it: 5tr, 1.2tr, 500k (the unit of a million comes from the catalog). */
export const amountWords = (amount: number, say: Say): string => {
    if (Math.abs(amount) >= 1_000_000) return `${trimmed(amount / 1_000_000)}${say("agentGraphs.unit.million")}`
    return Math.abs(amount) >= 1_000 ? `${trimmed(amount / 1_000)}k` : String(amount)
}

const trimmed = (value: number): string => String(Math.round(value * 100) / 100)

const valueWords = (value: FactValue | ReadonlyArray<string>, spec: FactSpec | undefined, say: Say): string => {
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === "number" && spec?.unit === "vnd") return amountWords(value, say)
    return String(value)
}

const termWords = (term: Comparison, registry: FactRegistry, say: Say): string => {
    const spec = registry[term.fact]
    const label = spec === undefined ? term.fact : say(spec.labelKey)
    const op = say(`agentGraphs.op.${term.op}`)
    if (term.op === "known") return `${label} ${op}`
    return `${label} ${op} ${valueWords(term.value, spec, say)}`
}

/** The sentence a condition reads as on the edge and the card, written by code so the model cannot describe a rule it does not hold. */
export const conditionWords = (condition: Condition, registry: FactRegistry, say: Say): string => {
    if ("all" in condition)
        return condition.all.map((member) => conditionWords(member, registry, say)).join(say("agentGraphs.join.all"))
    if ("any" in condition)
        return condition.any.map((member) => conditionWords(member, registry, say)).join(say("agentGraphs.join.any"))
    return termWords(condition, registry, say)
}

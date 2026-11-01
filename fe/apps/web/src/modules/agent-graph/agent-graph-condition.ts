import { z } from "zod"
import type { AgentGraphFactData, AgentGraphOp, AgentGraphTermForm } from "@/modules/types"
import type { AgentGraphT } from "./agent-graph-words"

const OPS: ReadonlyArray<AgentGraphOp> = ["lt", "lte", "gt", "gte", "eq", "neq", "in", "known"]

const OP_NAMES: ReadonlySet<string> = new Set(OPS)

const comparisonSchema = z.object({
    fact: z.string(),
    op: z.enum(["lt", "lte", "gt", "gte", "eq", "neq", "in", "known"]),
    value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]).optional(),
})
const flatSchema = z.object({ all: z.array(comparisonSchema) })

const termOf = (comparison: z.infer<typeof comparisonSchema>): AgentGraphTermForm => {
    const { value } = comparison
    if (typeof value === "number") return { fact: comparison.fact, op: comparison.op, amount: value, text: "" }
    if (Array.isArray(value)) return { fact: comparison.fact, op: comparison.op, amount: 0, text: value.join(", ") }
    return { fact: comparison.fact, op: comparison.op, amount: 0, text: value === undefined ? "" : String(value) }
}

/**
 * The terms a condition is made of when the form can draw it: one comparison, or an `all` of comparisons. Null for what it cannot
 * draw (an `any`, a group inside a group), which the form keeps as it is and never rewrites.
 */
export const termsOfWhen = (when: unknown): ReadonlyArray<AgentGraphTermForm> | null => {
    const single = comparisonSchema.safeParse(when)
    if (single.success) return [termOf(single.data)]
    const flat = flatSchema.safeParse(when)
    return flat.success ? flat.data.all.map(termOf) : null
}

/** What a term of the form writes into the draft: the value its fact's type asks for. */
const comparisonOf = (term: AgentGraphTermForm, fact: AgentGraphFactData | undefined): unknown => {
    if (term.op === "known") return { fact: term.fact, op: term.op }
    if (term.op === "in")
        return {
            fact: term.fact,
            op: term.op,
            value: term.text
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item !== ""),
        }
    if (fact?.type === "number") return { fact: term.fact, op: term.op, value: term.amount }
    if (fact?.type === "boolean") return { fact: term.fact, op: term.op, value: term.text === "true" }
    return { fact: term.fact, op: term.op, value: term.text }
}

/** The condition the terms write: one comparison, or an `all` of them. */
export const conditionOfTerms = (
    terms: ReadonlyArray<AgentGraphTermForm>,
    facts: ReadonlyArray<AgentGraphFactData>,
): unknown => {
    const comparisons = terms.map((term) =>
        comparisonOf(
            term,
            facts.find((fact) => fact.key === term.fact),
        ),
    )
    return comparisons.length === 1 ? comparisons[0] : { all: comparisons }
}

/** The operators a fact of that type may be compared with, in the order the owner reads them. */
export const opsOfFact = (fact: AgentGraphFactData | undefined): ReadonlyArray<AgentGraphOp> => {
    if (fact?.type === "number") return ["gte", "gt", "lte", "lt", "eq", "neq", "known"]
    if (fact?.type === "boolean") return ["eq", "known"]
    return ["eq", "neq", "in", "known"]
}

/** A term for a fact, with the comparison the owner most likely means first. */
export const newTermOf = (fact: AgentGraphFactData | undefined): AgentGraphTermForm => {
    const key = fact?.key ?? ""
    if (fact?.type === "number") return { fact: key, op: "gte", amount: fact.unit === "vnd" ? 5_000_000 : 1, text: "" }
    if (fact?.type === "boolean") return { fact: key, op: "eq", amount: 0, text: "true" }
    return { fact: key, op: "eq", amount: 0, text: fact?.allowed[0] ?? "" }
}

/**
 * The term that continues one that came before: after a lower bound ("from 5 million") comes the upper bound of a stretch, four
 * times as far; after an upper bound ("under 20 million") comes the lower bound that starts where it ended, so branches added one by
 * one leave no gap. Anything else starts from the fact's own first term.
 */
export const newTermAfter = (fact: AgentGraphFactData | undefined, previous: AgentGraphTermForm | undefined): AgentGraphTermForm => {
    const fresh = newTermOf(fact)
    if (fact?.type !== "number" || previous?.fact !== fact.key) return fresh
    if (previous.op === "gte" || previous.op === "gt") return { ...fresh, op: "lt", amount: previous.amount * 4 }
    return previous.op === "lt" || previous.op === "lte" ? { ...fresh, op: "gte", amount: previous.amount } : fresh
}

/** What the words of a condition need: the facts, the translator, and how an amount is written. */
export interface AgentGraphConditionWords {
    readonly t: AgentGraphT
    readonly facts: ReadonlyArray<AgentGraphFactData>
    readonly amount: (vnd: number) => string
}

const opWordOf = (t: AgentGraphT, op: AgentGraphOp): string => {
    const words: Readonly<Record<AgentGraphOp, string>> = {
        lt: t("op_lt"),
        lte: t("op_lte"),
        gt: t("op_gt"),
        gte: t("op_gte"),
        eq: t("op_eq"),
        neq: t("op_neq"),
        in: t("op_in"),
        known: t("op_known"),
    }
    return words[op]
}

const valueWordOf = (term: AgentGraphTermForm, words: AgentGraphConditionWords): string => {
    const fact = words.facts.find((entry) => entry.key === term.fact)
    if (term.op === "known") return ""
    if (fact?.type === "number") return fact.unit === "vnd" ? words.amount(term.amount) : String(term.amount)
    if (fact?.type === "boolean") return term.text === "true" ? words.t("valueYes") : words.t("valueNo")
    return term.text
}

const labelOf = (term: AgentGraphTermForm, words: AgentGraphConditionWords): string =>
    words.facts.find((entry) => entry.key === term.fact)?.label ?? term.fact

/** One comparison as a phrase: what is compared, how, and with what. */
const phraseOf = (term: AgentGraphTermForm, words: AgentGraphConditionWords, withLabel: boolean): string => {
    const rest = [opWordOf(words.t, term.op), valueWordOf(term, words)].filter((part) => part !== "").join(" ")
    return withLabel ? `${labelOf(term, words)} ${rest}` : rest
}

const isLower = (term: AgentGraphTermForm): boolean => term.op === "gt" || term.op === "gte"
const isUpper = (term: AgentGraphTermForm): boolean => term.op === "lt" || term.op === "lte"

/** "from 5 million to under 20 million": a lower and an upper bound of one number read as one stretch. */
const stretchOf = (low: AgentGraphTermForm, high: AgentGraphTermForm, words: AgentGraphConditionWords): string => {
    const upper =
        high.op === "lt"
            ? words.t("stretchToLt", { value: valueWordOf(high, words) })
            : words.t("stretchToLte", { value: valueWordOf(high, words) })
    return `${opWordOf(words.t, low.op)} ${valueWordOf(low, words)} ${upper}`
}

/**
 * The sentence of a condition in the owner's words: the terms joined by "and", a lower and an upper bound of the same fact read as
 * one stretch ("from 5 million to under 20 million"). With no label the sentence drops the name of the fact, for an edge of the map
 * whose decision point reads one fact only.
 */
export const termsWords = (
    terms: ReadonlyArray<AgentGraphTermForm>,
    words: AgentGraphConditionWords,
    withLabel: boolean,
): string => {
    const [first, second] = terms
    const isStretch =
        terms.length === 2 &&
        first?.fact === second?.fact &&
        first !== undefined &&
        second !== undefined &&
        ((isLower(first) && isUpper(second)) || (isUpper(first) && isLower(second)))
    if (isStretch) {
        const [low, high] = isLower(first) ? [first, second] : [second, first]
        const stretch = stretchOf(low, high, words)
        return withLabel ? `${labelOf(low, words)} ${stretch}` : stretch
    }
    return terms.map((term) => phraseOf(term, words, withLabel)).join(words.t("joinAnd"))
}

/** True for a string that is one of the operators. */
export const isOp = (value: string): value is AgentGraphOp => OP_NAMES.has(value)

import type { Condition, GraphDocument } from "../agent-graphs.contracts"
import type { StatedRulesAnswer } from "./unheld-rules.schema"

const MAX_QUOTE = 200

/** A rule the setup text states and the graph does not hold. */
export interface UnheldRule {
    /** The sum the text names. */
    readonly amountVnd: number
    /** The sentence that says it. */
    readonly quote: string
}

const valuesOf = (condition: Condition): ReadonlyArray<number> => {
    if ("all" in condition) return condition.all.flatMap((item) => valuesOf(item))
    if ("any" in condition) return condition.any.flatMap((item) => valuesOf(item))
    return condition.op !== "known" && typeof condition.value === "number" ? [condition.value] : []
}

const boundariesOf = (document: GraphDocument): ReadonlySet<number> =>
    new Set(
        document.nodes.flatMap((node) =>
            (node.decide?.branches ?? []).flatMap((branch) => (branch.when === "else" ? [] : valuesOf(branch.when))),
        ),
    )

/** A text with every run of white space as one space, so a quote is found across a line break of the text. */
const spaced = (text: string): string => text.replaceAll(/\s+/gu, " ").trim()

/** The rules whose sum no condition of the graph holds: a comparison of numbers. */
export const notHeldBy = (rules: ReadonlyArray<UnheldRule>, document: GraphDocument): ReadonlyArray<UnheldRule> => {
    const held = boundariesOf(document)
    return rules.filter((rule) => !held.has(rule.amountVnd))
}

/**
 * The rules the model read from the setup text that stand: which sentence states that a person decides from a sum is the model's
 * reading, never a list of words here. Code keeps what it can prove: the quote is in one of the texts word for word (a quote that
 * is not there was not read from the setup), the sum is a whole positive number that no condition of the graph holds, and each sum
 * is listed once. Prose decides nothing: the backend runs only the graph, so a rule that lives in the text alone is a promise nobody
 * keeps, and the owner has to see it.
 */
export const unheldRulesOf = (
    stated: StatedRulesAnswer,
    texts: ReadonlyArray<string>,
    document: GraphDocument,
): ReadonlyArray<UnheldRule> => {
    const written = texts.map((text) => spaced(text))
    const quoted = stated.rules
        .map((rule) => ({ amountVnd: rule.amount_vnd, quote: spaced(rule.quote) }))
        .filter((rule) => Number.isInteger(rule.amountVnd) && rule.amountVnd > 0)
        .filter((rule) => rule.quote !== "" && written.some((text) => text.includes(rule.quote)))
        .map((rule) => ({ amountVnd: rule.amountVnd, quote: rule.quote.slice(0, MAX_QUOTE) }))
    const found = notHeldBy(quoted, document)
    return found.filter((rule, index) => found.findIndex((other) => other.amountVnd === rule.amountVnd) === index)
}

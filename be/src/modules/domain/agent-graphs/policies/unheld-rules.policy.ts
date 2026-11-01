import type { Condition, GraphDocument } from "../agent-graphs.contracts"
import { amountsOf, plainOf } from "./outgoing-facts.policy"

/** A sentence that asks for a person or a limit: only these can be rules, so a price list raises nothing. */
const RULE_WORDS: ReadonlyArray<string> = ["duyet", "cho chu", "xin y kien", "hoi chu", "approv", "wait", "sign off"]

const SENTENCE = /[^.!?;\n]+(?:[.,]\d[^.!?;\n]*)*/gu

const MAX_QUOTE = 200

/** A rule the setup text states and the graph does not hold. */
export interface UnheldRule {
    /** The sum the text names. */
    readonly amountVnd: number
    /** The sentence that says it. */
    readonly quote: string
}

const valuesOf = (condition: Condition): ReadonlyArray<number> => {
    if ("all" in condition) return condition.all.flatMap(valuesOf)
    if ("any" in condition) return condition.any.flatMap(valuesOf)
    return condition.op !== "known" && typeof condition.value === "number" ? [condition.value] : []
}

const boundariesOf = (document: GraphDocument): ReadonlySet<number> =>
    new Set(
        document.nodes.flatMap((node) =>
            (node.decide?.branches ?? []).flatMap((branch) => (branch.when === "else" ? [] : valuesOf(branch.when))),
        ),
    )

/**
 * The sums the setup text names as a rule (a sentence with a figure and a word for approval) that no condition of the graph holds. Prose
 * decides nothing: the backend runs only the graph, so a rule that lives in the text alone is a promise nobody keeps, and the owner has
 * to see it. It reads figures, not meaning: a rule in words alone raises nothing.
 */
export const unheldRulesOf = (texts: ReadonlyArray<string>, document: GraphDocument): ReadonlyArray<UnheldRule> => {
    const held = boundariesOf(document)
    const found = texts.flatMap((text) =>
        [...text.matchAll(SENTENCE)]
            .map(([sentence]) => sentence.trim())
            .filter((sentence) => RULE_WORDS.some((word) => plainOf(sentence).includes(word)))
            .flatMap((sentence) =>
                amountsOf(sentence)
                    .filter((amountVnd) => !held.has(amountVnd))
                    .map((amountVnd) => ({ amountVnd, quote: sentence.slice(0, MAX_QUOTE) })),
            ),
    )
    return found.filter((rule, index) => found.findIndex((other) => other.amountVnd === rule.amountVnd) === index)
}

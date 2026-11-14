import { factLine, isRelationKind, type FactRecord, type RelationInput } from "@modules/domain/brain-facts"
import { fieldsOf } from "./extraction.policy"

/** The most facts of one document the relation pass reads in one call. */
export const RELATION_FACTS_MAX = 80

/** The most relations one answer may add. */
export const RELATIONS_MAX = 120

/** Who the reading files relations as. */
export const RELATION_AUTHOR = "NIVO"

/** The standing instructions of the relation pass: a second, cheap call over the facts already read, not over the document. */
export const RELATIONS_PROMPT: string = [
    "You get a numbered list of FACTS of one business, read from one of its documents. Link the facts that belong together.",
    'Reply with ONLY a JSON object, no markdown: {"relations":[{"from":number,"to":number,"kind":"part_of|applies_to|depends_on|exception_of|related","label":string}]}. None: {"relations":[]}.',
    "RULES",
    "1. part_of: the first is a detail of the second (a fee of a delivery policy). applies_to: a rule or price of the first applies to the second. depends_on: the first holds only when the second holds. exception_of: the first is a narrower case that overrides the second. related: anything else worth following.",
    "2. Link only what the facts themselves show. Never invent a fact. Never link a fact to itself. At most one relation per pair.",
    "3. label = two to four words in the language of the facts, naming the relation as a person would (in Vietnamese facts, the Vietnamese words for delivered by, paid by, applies to).",
].join("\n")

/** The user message of the relation pass: the facts, numbered from 1. */
export const relationsPrompt = (facts: ReadonlyArray<FactRecord>): string =>
    ["FACTS:", ...facts.map((fact, index) => `${index + 1}. ${factLine(fact)}`)].join("\n")

/** Whether a parsed value is a list. */
const isList = (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value)

/** The 1-based position of a fact in the list, or null. */
const positionOf = (value: unknown, count: number): number | null =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= count ? value : null

/**
 * The relations of one parsed answer, as edges between the listed facts: an item that names a fact outside the list, the same fact
 * twice or an unknown kind is dropped; a pair is linked once. Null when the answer holds no relations list (nothing is linked).
 */
export const parseRelations = (
    answer: unknown,
    facts: ReadonlyArray<FactRecord>,
): ReadonlyArray<RelationInput> | null => {
    const items = fieldsOf(answer)?.get("relations")
    if (!isList(items)) return null
    const seen = new Set<string>()
    return items.slice(0, RELATIONS_MAX).flatMap((item): ReadonlyArray<RelationInput> => {
        const fields = fieldsOf(item)
        const from = positionOf(fields?.get("from"), facts.length)
        const to = positionOf(fields?.get("to"), facts.length)
        const kind = fields?.get("kind")
        if (from === null || to === null || from === to || typeof kind !== "string" || !isRelationKind(kind)) return []
        const pair = [from, to].sort((a, b) => a - b).join(":")
        const fromFact = facts[from - 1]
        const toFact = facts[to - 1]
        if (seen.has(pair) || fromFact === undefined || toFact === undefined) return []
        seen.add(pair)
        const label = fields?.get("label")
        return [
            {
                fromFactId: fromFact.id,
                toFactId: toFact.id,
                kind,
                label: typeof label === "string" ? label.replaceAll(/\s+/g, " ").trim().slice(0, 80) : null,
                createdBy: RELATION_AUTHOR,
            },
        ]
    })
}

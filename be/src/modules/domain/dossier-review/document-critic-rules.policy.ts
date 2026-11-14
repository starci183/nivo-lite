import { sameValue } from "@modules/domain/brain-facts"
import { argueInTime, arguesInTime } from "./critic-window.policy"
import { boundedPoints, type RuleCritique } from "./document-critic-bound.policy"
import {
    contradictionPairOf,
    type CriticCandidate,
    type CriticFact,
    type CriticPoint,
    type CriticQuote,
    type CritiqueInput,
} from "./document-critic.contracts"
import { factQuote, valueChoice } from "./document-critic-text.policy"

const keyOf = (fact: CriticFact): string => `${fact.subjectKey}|${fact.attribute}`

/** The first two of the facts that argue once their periods are read (`argueInTime`), or null when no two do. */
const arguingPair = (facts: ReadonlyArray<CriticFact>): readonly [CriticFact, CriticFact] | null => {
    for (const [index, a] of facts.entries()) {
        const b = facts.slice(index + 1).find((other) => argueInTime(a, other))
        if (b !== undefined) return [a, b]
    }
    return null
}

/**
 * inside_contradiction (D1): ONE document gives ONE key two different values that argue (both cannot be in force). Two values
 * stated for periods that do not overlap, or a period's value beside the standing one, are not a contradiction (date arithmetic,
 * `critic-window.policy`); the same value twice is a duplicate and asks nothing.
 */
const insideByFacts = (input: CritiqueInput): ReadonlyArray<CriticPoint> => {
    const byKey = new Map<string, Array<CriticFact>>()
    for (const fact of input.facts) byKey.set(keyOf(fact), [...(byKey.get(keyOf(fact)) ?? []), fact])
    return [...byKey.entries()].flatMap(([key, facts]): Array<CriticPoint> => {
        const pair = arguingPair(facts.filter((fact, index) => facts.findIndex((other) => sameValue(other.value, fact.value)) === index))
        if (pair === null) return []
        const [a, b] = pair
        const quotes = [a, b].map((fact) => factQuote(fact, input.passages, input.sourceId, input.title))
        const label = `${a.subjectLabel} · ${a.attributeLabel}`
        return [
            {
                kind: "inside_contradiction",
                origin: "rule",
                severity: "high",
                subject: key,
                line: input.say("inside.line", { label }),
                why: input.say("inside.why", { a: a.value, b: b.value }),
                question: input.say("inside.question", { label }),
                quotes,
                against: null,
                choices: [valueChoice("a", a.value, a.value, a.id), valueChoice("b", b.value, b.value, b.id)],
            },
        ]
    })
}

/**
 * The candidate a waiting fact of the document argues with, of the given ways of finding it: another truth with ANOTHER value (once
 * normalised: the same value is a duplicate, never a question) whose period argues with it; the truth in force first, else a value
 * waiting from another document. Null when none argues.
 */
const rivalOf = (input: CritiqueInput, fact: CriticFact, match: CriticCandidate["match"]): CriticCandidate | null => {
    const rivals = (input.candidates.get(fact.id) ?? []).filter(
        (candidate) =>
            candidate.match === match &&
            candidate.fact.id !== fact.id &&
            !sameValue(candidate.fact.value, fact.value) &&
            arguesInTime(fact, candidate.fact, candidate.fact.status === "active"),
    )
    return rivals.find((one) => one.fact.status === "active") ?? rivals.find((one) => one.fact.status === "proposed") ?? null
}

/**
 * shop_contradiction / other_document, SAME KEY: a fact of the document against a truth in force (from another source) or a value
 * waiting from another document on the exact same key. Only an exact key is this rule's business; the same thing under another key
 * is the same-fact judge's link (`linkedFacts`). A value stated for a period over a standing value, or beside another period it does
 * not overlap, argues with nothing.
 */
const againstShop = (input: CritiqueInput): ReadonlyArray<readonly [CriticFact, CriticCandidate]> =>
    input.facts.flatMap((fact) => {
        const other = rivalOf(input, fact, "key")
        return other === null ? [] : [[fact, other] as const]
    })

/**
 * shop_contradiction / other_document, ANOTHER KEY: a WAITING truth of the document that the same-fact judge linked to another truth
 * (`conflictWith`: the same thing, read under another key) giving another value: in force, or waiting from another document. The
 * link is the judge's (a model reading two lines); code compares only ids and normal-form values.
 */
const linkedFacts = (input: CritiqueInput): ReadonlyArray<readonly [CriticFact, CriticCandidate]> =>
    input.facts.flatMap((fact) => {
        if (fact.status !== "proposed") return []
        const other = rivalOf(input, fact, "named")
        return other === null ? [] : [[fact, other] as const]
    })

/** The point that sets a fact of the document against another truth: ONE card naming both, with the two values to pick from. */
const pointAgainst = (input: CritiqueInput, fact: CriticFact, other: CriticCandidate): CriticPoint => {
    const inForce = other.fact.status === "active"
    const label = `${fact.subjectLabel} · ${fact.attributeLabel}`
    const where = other.sourceTitle === null ? "" : ` (${other.sourceTitle})`
    const { say } = input
    const words = { label, value: fact.value, other: other.fact.value, where }
    const quote = factQuote(fact, input.passages, input.sourceId, input.title)
    const otherQuote: CriticQuote = {
        text: (other.fact.quote ?? other.fact.value).slice(0, 300),
        passageId: null,
        chunkHash: other.fact.chunkHash,
        role: "other",
        factId: other.fact.id,
        sourceId: null,
        sourceTitle: other.sourceTitle,
    }
    const against = {
        kind: inForce ? ("truth" as const) : ("proposal" as const),
        value: other.fact.value,
        sourceTitle: other.sourceTitle,
        factId: other.fact.id,
    }
    // The same key keeps the subject its points always had (their stored identity); a link names the other truth too, so one fact
    // linked to a truth and set against another on its own key gives two points.
    const subject = other.match === "named" ? `${keyOf(fact)}|${other.fact.id}` : keyOf(fact)
    if (inForce) {
        return {
            kind: "shop_contradiction",
            origin: "rule",
            severity: "high",
            subject,
            line: say("shop.line", words),
            why: say("shop.why", words),
            question: say("shop.question", words),
            quotes: [quote, otherQuote],
            against,
            choices: [
                { id: "a", label: say("choice.by_file_value", { value: fact.value }), needsInput: false, inputHint: null, answer: { kind: "keep_document", factId: fact.id, value: fact.value } },
                { id: "b", label: say("choice.by_shop", { value: other.fact.value }), needsInput: false, inputHint: null, answer: { kind: "keep_shop", factId: other.fact.id, value: other.fact.value } },
            ],
        }
    }
    return {
        kind: "other_document",
        origin: "rule",
        severity: "medium",
        subject,
        line: say("other.line", words),
        why: other.sourceTitle === null ? say("other.why", words) : say("other.why_titled", { ...words, title: other.sourceTitle }),
        question: say("other.question", words),
        quotes: [quote, otherQuote],
        against,
        choices: [
            valueChoice("a", say("choice.use", { value: fact.value }), fact.value, fact.id),
            valueChoice("b", say("choice.keep_value", { value: other.fact.value }), other.fact.value, other.fact.id),
        ],
    }
}

/** The hashes a point quotes from this document, sorted: with its kind and subject, its identity. */
export const ownHashesOf = (point: CriticPoint): string =>
    point.quotes
        .filter((quote) => quote.role === "this")
        .map((quote) => quote.chunkHash ?? "")
        .sort((a, b) => a.localeCompare(b))
        .join(",")

/**
 * What CODE says about a document (owner 2026-11-12: documents are entered by the business's own people and are TRUSTED; only
 * contradictions between data ask the founder). Every rule compares DATA with DATA, by ids, keys, periods and normal-form values,
 * and reads no line by itself:
 * - one document giving one key two values (`insideByFacts`, D1);
 * - a value of the document against the truth in force, or a value waiting from another document, on the same key (`againstShop`);
 * - a waiting value the same-fact judge linked to another truth (the same thing under another key) with another value
 *   (`linkedFacts`).
 * ONE point per pair of truths: a pair raised twice here is kept once, and a pair an open point of another document already asks
 * about (`asked`) is not raised again on this side. A typo, a vague, stale or template line, a wrong sum: no point (they go in force
 * as filed). Text addressed to an AI is the model's one question (`PRODUCED_MODEL_KINDS`).
 */
export const ruleCritique = (input: CritiqueInput): RuleCritique => {
    const asked = new Set(input.asked ?? [])
    const pairs = [...againstShop(input), ...linkedFacts(input)].filter(([fact, other]) => {
        const pair = contradictionPairOf(fact.id, other.fact.id)
        if (asked.has(pair)) return false
        asked.add(pair)
        return true
    })
    const all = [...insideByFacts(input), ...pairs.map(([fact, other]) => pointAgainst(input, fact, other))]
    const seen = new Set<string>()
    return boundedPoints(
        input.say,
        all.filter((point) => {
            const identity = `${point.kind}|${point.subject}|${ownHashesOf(point)}`
            if (seen.has(identity)) return false
            seen.add(identity)
            return true
        }),
    )
}

/** The points of `ruleCritique` alone. */
export const criticRules = (input: CritiqueInput): ReadonlyArray<CriticPoint> => ruleCritique(input).points

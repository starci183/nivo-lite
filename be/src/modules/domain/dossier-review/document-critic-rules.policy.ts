import { factSlugOf, sameValue } from "@modules/domain/brain-facts"
import { blanksIn } from "./blank.policy"
import { foldText } from "./document-state.policy"
import type {
    CriticCandidate,
    CriticFact,
    CriticPoint,
    CriticQuote,
    CritiqueInput,
} from "./document-critic.contracts"
import {
    dateText,
    datesIn,
    factOfLine,
    factQuote,
    inputChoice,
    lineQuote,
    linesOf,
    looksLikeSlip,
    moneyIn,
    moneyOf,
    moneyText,
    removeChoice,
    valueChoice,
    type CriticLine,
} from "./document-critic-text.policy"
import { hasAnyWord } from "./rule-kit.policy"

/** Words that promise money changes hands; a line with one and no number cannot be acted on. */
const MONEY_WORDS = ["tinh them", "phu thu", "thu them", "cong them", "tinh phi", "phi", "gia", "giam", "giam gia", "chiet khau", "coc", "dat coc"]

/** Words that leave the amount or the condition to later. */
const LATER_WORDS = ["bao sau", "tuy", "tuy truong hop", "thoa thuan", "lien he", "theo thuc te", "tinh sau", "se bao"]

/** Words that make a line about an offer or a rule still meant to apply. */
const OFFER_WORDS = ["uu dai", "khuyen mai", "giam", "hieu luc", "ap dung", "het han", "tang", "mien phi"]

/** Words that make a line about a period (a closing, a validity). */
const PERIOD_WORDS = [...OFFER_WORDS, "nghi", "dong cua", "den", "tu", "toi", "truoc ngay", "den het"]

/** Words of a total. */
const TOTAL_WORDS = ["tong", "tong cong", "cong", "thanh tien", "tong tien"]

/** Words of an attribute that must carry an amount. */
const PRICE_ATTRIBUTES = ["gia", "phi", "tien", "muc phi", "muc gia", "phu thu", "coc"]

const hasDigit = (text: string): boolean => /\d/u.test(text)

/** What every rule reads about the document. */
interface Reading {
    readonly input: CritiqueInput
    readonly lines: ReadonlyArray<CriticLine>
}

const quoteOf = (reading: Reading, line: CriticLine, fact: CriticFact | null): CriticQuote =>
    lineQuote(line, reading.input.sourceId, reading.input.title, fact?.id ?? null)

const nameOf = (line: CriticLine): string => line.label ?? line.heading ?? line.text.slice(0, 60)

/** inside_contradiction / typo: one labelled thing given two amounts in the document (a delivery fee of 30.000 in one section, 25.000 in another). */
const insideByLines = (reading: Reading): ReadonlyArray<CriticPoint> => {
    const byLabel = new Map<string, Array<{ readonly line: CriticLine; readonly amount: number }>>()
    for (const line of reading.lines) {
        const amount = line.value === null ? undefined : moneyIn(line.value)[0]?.amount
        if (line.labelKey === null || amount === undefined) continue
        byLabel.set(line.labelKey, [...(byLabel.get(line.labelKey) ?? []), { line, amount }])
    }
    return [...byLabel.entries()].flatMap(([key, items]): Array<CriticPoint> => {
        const distinct = [...new Map(items.map((item) => [item.amount, item])).values()]
        const [a, b] = distinct
        if (a === undefined || b === undefined) return []
        const factA = factOfLine(a.line, reading.input.facts)
        const factB = factOfLine(b.line, reading.input.facts)
        const label = nameOf(a.line)
        const slip = looksLikeSlip(a.amount, b.amount)
        const { say } = reading.input
        const amounts = { a: moneyText(a.amount), b: moneyText(b.amount) }
        return [
            {
                kind: slip ? "typo" : "inside_contradiction",
                origin: "rule",
                severity: "high",
                subject: key,
                line: say(slip ? "slip.line" : "inside.line", { label }),
                why: say(slip ? "slip.why" : "inside.why", amounts),
                question: say("inside.question", { label }),
                quotes: [quoteOf(reading, a.line, factA), quoteOf(reading, b.line, factB)],
                against: null,
                choices: [
                    valueChoice("a", moneyText(a.amount), moneyText(a.amount), factA?.id ?? null),
                    valueChoice("b", moneyText(b.amount), moneyText(b.amount), factB?.id ?? null),
                ],
                target: { subjectLabel: a.line.heading ?? label, attributeLabel: label },
            },
        ]
    })
}

const keyOf = (fact: CriticFact): string => `${fact.subjectKey}|${fact.attribute}`

/** inside_contradiction: two facts of the document on one key with different values, when no labelled line already shows it. */
const insideByFacts = (reading: Reading, shown: ReadonlySet<string>): ReadonlyArray<CriticPoint> => {
    const byKey = new Map<string, Array<CriticFact>>()
    for (const fact of reading.input.facts) byKey.set(keyOf(fact), [...(byKey.get(keyOf(fact)) ?? []), fact])
    return [...byKey.entries()].flatMap(([key, facts]): Array<CriticPoint> => {
        const [a, b] = facts.filter((fact, index) => facts.findIndex((other) => sameValue(other.value, fact.value)) === index)
        if (a === undefined || b === undefined) return []
        const quotes = [a, b].map((fact) => factQuote(fact, reading.input.passages, reading.input.sourceId, reading.input.title))
        const hashes = quotes.map((quote) => quote.chunkHash ?? "").sort().join(",")
        if (shown.has(hashes)) return []
        const label = `${a.subjectLabel} · ${a.attributeLabel}`
        return [
            {
                kind: "inside_contradiction",
                origin: "rule",
                severity: "high",
                subject: key,
                line: reading.input.say("inside.line", { label }),
                why: reading.input.say("inside.why", { a: a.value, b: b.value }),
                question: reading.input.say("inside.question", { label }),
                quotes,
                against: null,
                choices: [valueChoice("a", a.value, a.value, a.id), valueChoice("b", b.value, b.value, b.id)],
            },
        ]
    })
}

/** shop_contradiction / other_document / typo: a fact of the document against a truth in force or a waiting proposal on the same thing. */
const againstShop = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.input.facts.flatMap((fact): Array<CriticPoint> => {
        // Only an exact key is a rule's business: a candidate found by meaning may be another thing, so the model judges it.
        const near = (reading.input.candidates.get(fact.id) ?? []).filter(
            (candidate) => candidate.match === "key" && candidate.fact.id !== fact.id && !sameValue(candidate.fact.value, fact.value),
        )
        const truth = near.find((candidate) => candidate.fact.status === "active")
        const other = truth ?? near.find((candidate) => candidate.fact.status === "proposed")
        if (other === undefined) return []
        return [pointAgainst(reading, fact, other)]
    })

const pointAgainst = (reading: Reading, fact: CriticFact, other: CriticCandidate): CriticPoint => {
    const inForce = other.fact.status === "active"
    const mine = moneyOf(fact.value)
    const theirs = moneyOf(other.fact.value)
    const slip = mine !== null && theirs !== null && looksLikeSlip(mine, theirs)
    const label = `${fact.subjectLabel} · ${fact.attributeLabel}`
    const where = other.sourceTitle === null ? "" : ` (${other.sourceTitle})`
    const { say } = reading.input
    const words = { label, value: fact.value, other: other.fact.value, where }
    const quote = factQuote(fact, reading.input.passages, reading.input.sourceId, reading.input.title)
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
    if (slip) {
        return {
            kind: "typo",
            origin: "rule",
            severity: "high",
            subject: keyOf(fact),
            line: say("typo.line", words),
            why: say(inForce ? "typo.why_truth" : "typo.why_document", words),
            question: say("typo.question", words),
            quotes: [quote, otherQuote],
            against,
            choices: [
                { id: "a", label: say("choice.fix_to", { value: other.fact.value }), needsInput: false, inputHint: null, answer: { kind: "value", factId: fact.id, value: other.fact.value } },
                { id: "b", label: say("choice.keep_value", { value: fact.value }), needsInput: false, inputHint: null, answer: { kind: "keep_document", factId: fact.id, value: fact.value } },
            ],
        }
    }
    if (inForce) {
        return {
            kind: "shop_contradiction",
            origin: "rule",
            severity: "high",
            subject: keyOf(fact),
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
        subject: keyOf(fact),
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

/** vague: a line that promises money (or leaves it to later) with no number an agent could quote (rush delivery "costs extra, staff will say"). */
const vagueLines = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.lines.flatMap((line): Array<CriticPoint> => {
        if (hasDigit(line.text) || blanksIn(line.text).length > 0) return []
        const money = hasAnyWord(line.folded, MONEY_WORDS)
        const later = hasAnyWord(line.folded, LATER_WORDS)
        if (!money || (!later && !hasAnyWord(line.folded, ["tinh them", "phu thu", "thu them", "cong them"]))) return []
        const name = line.heading ?? nameOf(line)
        const fact = factOfLine(line, reading.input.facts)
        return [
            {
                kind: "vague",
                origin: "rule",
                severity: "medium",
                subject: line.folded.slice(0, 120),
                line: reading.input.say("vague.line", { name }),
                why: reading.input.say("vague.why"),
                question: reading.input.say("vague.question", { name }),
                quotes: [quoteOf(reading, line, fact)],
                against: null,
                choices: [
                    inputChoice("a", reading.input.say("choice.fill_amount"), reading.input.say("vague.hint", { name }), fact?.id ?? null),
                    removeChoice("b", reading.input.say("choice.drop_rule"), fact?.id ?? null),
                ],
                target: { subjectLabel: name, attributeLabel: reading.input.say("target.extra") },
            },
        ]
    })

/** template: a blank left to fill in, or text a template left for another shop. */
const templateLines = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.lines.flatMap((line): Array<CriticPoint> => {
        const [blank] = blanksIn(line.text)
        if (blank === undefined) return []
        const fact = factOfLine(line, reading.input.facts) ?? reading.input.facts.find((one) => one.quote !== null && blanksIn(one.value).length > 0 && line.folded.includes(foldText(one.quote))) ?? null
        const name = nameOf(line)
        return [
            {
                kind: "template",
                origin: "rule",
                severity: "medium",
                subject: line.folded.slice(0, 120),
                line: reading.input.say(blank.kind === "blank" ? "template.line_blank" : "template.line_template", { name }),
                why: reading.input.say(blank.kind === "blank" ? "template.why_blank" : "template.why_template", { blank: blank.text }),
                question: reading.input.say("template.question", { name }),
                quotes: [quoteOf(reading, line, fact)],
                against: null,
                choices: [
                    inputChoice("a", reading.input.say("choice.fill_blank"), name, fact?.id ?? null),
                    removeChoice("b", reading.input.say("choice.drop_line"), fact?.id ?? null),
                ],
                target: {
                    subjectLabel: name,
                    attributeLabel: reading.input.say(hasAnyWord(line.folded, ["gia", "phi"]) || moneyIn(line.text).length > 0 ? "target.price" : "target.content"),
                },
            },
        ]
    })

/** stale_date: a line about a period whose last date is already past, or a date that does not exist. */
const staleLines = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.lines.flatMap((line): Array<CriticPoint> => {
        const dates = datesIn(line.text)
        if (dates.length === 0) return []
        const impossible = dates.find((date) => date.iso === null)
        const last = dates
            .flatMap((date) => (date.iso === null ? [] : [date.iso]))
            .sort((a, b) => a.localeCompare(b))
            .at(-1)
        const past = last !== undefined && last < reading.input.today && hasAnyWord(line.folded, PERIOD_WORDS)
        if (impossible === undefined && !past) return []
        const offer = hasAnyWord(line.folded, OFFER_WORDS)
        const fact = factOfLine(line, reading.input.facts)
        const name = line.heading ?? nameOf(line)
        return [
            {
                kind: "stale_date",
                origin: "rule",
                severity: impossible !== undefined || offer ? "high" : "low",
                subject: line.folded.slice(0, 120),
                line:
                    impossible === undefined
                        ? reading.input.say("stale.line_past", { date: dateText(last ?? "") })
                        : reading.input.say("stale.line_impossible", { date: impossible.text }),
                why:
                    impossible === undefined
                        ? reading.input.say(offer ? "stale.why_offer" : "stale.why_info", { today: dateText(reading.input.today) })
                        : reading.input.say("stale.why_impossible", { date: impossible.text }),
                question: reading.input.say("stale.question", { name }),
                quotes: [quoteOf(reading, line, fact)],
                against: null,
                choices: [
                    removeChoice("a", reading.input.say("choice.ended"), fact?.id ?? null),
                    inputChoice("b", reading.input.say("choice.fix_date"), reading.input.say("hint.until"), fact?.id ?? null),
                ],
                target: { subjectLabel: name, attributeLabel: reading.input.say("target.until") },
            },
        ]
    })

/** arithmetic: a total in a section that is not the sum of the other amounts listed there. */
const arithmeticLines = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.input.passages.flatMap((passage): Array<CriticPoint> => {
        const lines = reading.lines.filter((line) => line.passage.id === passage.id && line.value !== null)
        const total = lines.find((line) => line.labelKey !== null && hasAnyWord(line.labelKey, TOTAL_WORDS))
        const stated = total?.value === null || total === undefined ? undefined : moneyIn(total.value)[0]?.amount
        const parts = lines.filter((line) => line !== total).flatMap((line) => moneyIn(line.value ?? "").slice(0, 1))
        if (total === undefined || stated === undefined || parts.length < 2) return []
        const sum = parts.reduce((all, part) => all + part.amount, 0)
        if (sum === stated) return []
        const fact = factOfLine(total, reading.input.facts)
        const name = nameOf(total)
        const { say } = reading.input
        const words = { name, sum: moneyText(sum), stated: moneyText(stated) }
        return [
            {
                kind: "arithmetic",
                origin: "rule",
                severity: "high",
                subject: total.folded.slice(0, 120),
                line: say("arithmetic.line", words),
                why: say("arithmetic.why", words),
                question: say("arithmetic.question", words),
                quotes: [quoteOf(reading, total, fact)],
                against: null,
                choices: [
                    { id: "a", label: say("choice.fix_to", { value: words.sum }), needsInput: false, inputHint: null, answer: { kind: "value", factId: fact?.id ?? null, value: moneyText(sum) } },
                    { id: "b", label: say("choice.keep_value", { value: words.stated }), needsInput: false, inputHint: null, answer: { kind: "keep_document", factId: fact?.id ?? null, value: moneyText(stated) } },
                ],
                target: { subjectLabel: name, attributeLabel: say("target.total") },
            },
        ]
    })

/** missing: a fact whose attribute is a price or a fee and whose value gives no amount (and is not a blank, which `template` shows). */
const missingFacts = (reading: Reading): ReadonlyArray<CriticPoint> =>
    reading.input.facts.flatMap((fact): Array<CriticPoint> => {
        const attribute = factSlugOf(fact.attributeLabel).replaceAll("-", " ")
        if (!hasAnyWord(attribute, PRICE_ATTRIBUTES) || hasDigit(fact.value) || blanksIn(fact.value).length > 0) return []
        const label = `${fact.subjectLabel} · ${fact.attributeLabel}`
        return [
            {
                kind: "missing",
                origin: "rule",
                severity: "medium",
                subject: keyOf(fact),
                line: reading.input.say("missing.line", { label }),
                why: reading.input.say("missing.why", { value: fact.value }),
                question: reading.input.say("missing.question", { label }),
                quotes: [factQuote(fact, reading.input.passages, reading.input.sourceId, reading.input.title)],
                against: null,
                choices: [
                    inputChoice("a", reading.input.say("choice.fill_money"), label, fact.id),
                    removeChoice("b", reading.input.say("choice.drop"), fact.id),
                ],
            },
        ]
    })

/** The hashes a point quotes from this document, sorted: with its kind and subject, its identity. */
export const ownHashesOf = (point: CriticPoint): string =>
    point.quotes
        .filter((quote) => quote.role === "this")
        .map((quote) => quote.chunkHash ?? "")
        .sort((a, b) => a.localeCompare(b))
        .join(",")

/**
 * The deterministic rules over the WHOLE document (cheap and exact, so a later upload re-runs them all and the reconciliation keeps the
 * state of every point found again): contradictions inside the document and against the shop, typing slips, vague rules, blanks and
 * template text, past or impossible dates, totals that do not add up, prices with no amount. Each point once.
 */
export const criticRules = (input: CritiqueInput): ReadonlyArray<CriticPoint> => {
    const reading: Reading = { input, lines: linesOf(input.passages) }
    const byLines = insideByLines(reading)
    const shown = new Set(byLines.map(ownHashesOf))
    const all = [
        ...byLines,
        ...insideByFacts(reading, shown),
        ...againstShop(reading),
        ...vagueLines(reading),
        ...templateLines(reading),
        ...staleLines(reading),
        ...arithmeticLines(reading),
        ...missingFacts(reading),
    ]
    const seen = new Set<string>()
    return all.filter((point) => {
        const identity = `${point.kind}|${point.subject}|${ownHashesOf(point)}`
        if (seen.has(identity)) return false
        seen.add(identity)
        return true
    })
}

import { foldText, isoDate } from "./document-state.policy"
import {
    CRITIC_CAPS,
    type CriticChoice,
    type CriticFact,
    type CriticPassage,
    type CriticQuote,
} from "./document-critic.contracts"
import { displayAmount, displayDate } from "./rule-kit.policy"

/** One line of a passage as the critic reads it. */
export interface CriticLine {
    /** The line without its list mark. */
    readonly text: string
    /** Its folded form. */
    readonly folded: string
    /** The passage it is in. */
    readonly passage: CriticPassage
    /** The heading of its section, when the passage has one. */
    readonly heading: string | null
    /** The words before its first colon (the fee or item the line is about), when it is a labelled line. */
    readonly label: string | null
    /** The folded label. */
    readonly labelKey: string | null
    /** The words after that colon. */
    readonly value: string | null
}

/** A money amount written in a text. */
export interface Money {
    /** The amount in VND. */
    readonly amount: number
    /** As written. */
    readonly text: string
}

/** A date written in a text. */
export interface WrittenDate {
    /** YYYY-MM-DD, or null when the date does not exist (31/02/2026). */
    readonly iso: string | null
    /** As written. */
    readonly text: string
}

const LIST_MARK = /^(?:[-*+•·]|\d{1,2}[.)])\s+/u
const HEADING = /^#{1,6}\s+/u

/** The lines of the passages, in order, each with its section heading, label and value. */
export const linesOf = (passages: ReadonlyArray<CriticPassage>): ReadonlyArray<CriticLine> =>
    passages.flatMap((passage) => {
        let heading: string | null = null
        return passage.text.split("\n").flatMap((raw): Array<CriticLine> => {
            const trimmed = raw.trim()
            if (trimmed === "") return []
            if (HEADING.test(trimmed)) {
                heading = trimmed.replace(HEADING, "").trim()
                return []
            }
            const text = trimmed.replace(LIST_MARK, "").trim()
            const colon = text.indexOf(":")
            const label = colon > 0 && colon <= 80 ? text.slice(0, colon).trim() : null
            return [
                {
                    text,
                    folded: foldText(text),
                    passage,
                    heading,
                    label,
                    labelKey: label === null ? null : foldText(label),
                    value: label === null ? null : text.slice(colon + 1).trim(),
                },
            ]
        })
    })

/** A number, then a thousand / million word and a currency word or sign, each standing as a whole word ("5 orders" is no money, "5 or more" no million). */
const MONEY =
    /(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*(k|ngh\u00ecn|ng\u00e0n|tr|tri\u1ec7u)(?![\p{L}\d]))?(?:\s*(\u0111\u1ed3ng|vn\u0111|vnd|\u0111|\u20ab)(?![\p{L}\d]))?/giu

const SCALE: Readonly<Record<string, number>> = {
    k: 1_000,
    "ngh\u00ecn": 1_000,
    "ng\u00e0n": 1_000,
    tr: 1_000_000,
    "tri\u1ec7u": 1_000_000,
}

/** The money amounts of a text: a number with a currency word or sign after it, or with a thousand / million word. */
export const moneyIn = (text: string): ReadonlyArray<Money> =>
    [...text.normalize("NFC").matchAll(MONEY)].flatMap((match) => {
        const [whole, digits = "", scale, currency] = match
        if (scale === undefined && currency === undefined) return []
        const grouped = /^\d{1,3}(?:[.,]\d{3})+$/u.test(digits)
        const base = Number(grouped ? digits.replaceAll(/[.,]/gu, "") : digits)
        if (!Number.isFinite(base) || base <= 0) return []
        return [{ amount: base * (scale === undefined ? 1 : (SCALE[scale.toLowerCase()] ?? 1)), text: whole.trim() }]
    })

/** The first money amount of a value as written, or null. */
export const moneyOf = (value: string): number | null => moneyIn(value)[0]?.amount ?? moneyIn(`${value} ${DONG}`)[0]?.amount ?? null

/** The dates written dd/mm/yyyy (or with dots or dashes) in a text, existing or not. */
export const datesIn = (text: string): ReadonlyArray<WrittenDate> =>
    [...text.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/gu)].map((match) => ({
        iso: isoDate(Number(match[3]), Number(match[2]), Number(match[1])),
        text: match[0],
    }))

/** True when two amounts are about a power of ten apart (5.000 vs 50.000): the shape of a typing slip, not of a price change. */
export const looksLikeSlip = (a: number, b: number): boolean => {
    if (a <= 0 || b <= 0) return false
    const ratio = Math.max(a, b) / Math.min(a, b)
    if (ratio < CRITIC_CAPS.typoRatio) return false
    const power = 10 ** Math.round(Math.log10(ratio))
    return Math.abs(ratio / power - 1) <= 0.05
}

/** The currency sign the shops write after an amount. */
const DONG = "\u0111"

/** An amount as the shop writes it: 30.000 and the dong sign. */
export const moneyText = (amount: number): string => `${displayAmount(amount)} ${DONG}`

/** A date YYYY-MM-DD as people read it. */
export const dateText = displayDate

/** A quote of a line of this document, cut to the longest stored quote. */
export const lineQuote = (line: CriticLine, sourceId: string, title: string, factId: string | null): CriticQuote => ({
    text: line.text.slice(0, CRITIC_CAPS.quoteMax),
    passageId: line.passage.id,
    chunkHash: line.passage.hash,
    role: "this",
    factId,
    sourceId,
    sourceTitle: title,
})

/** A quote of a fact of this document (its own quote, else its line), placed in its passage when its hash is known. */
export const factQuote = (
    fact: CriticFact,
    passages: ReadonlyArray<CriticPassage>,
    sourceId: string,
    title: string,
): CriticQuote => {
    const passage =
        passages.find((one) => one.hash === fact.chunkHash) ??
        passages.find((one) => fact.quote !== null && foldText(one.text).includes(foldText(fact.quote)))
    return {
        text: (fact.quote ?? `${fact.subjectLabel} - ${fact.attributeLabel}: ${fact.value}`).slice(0, CRITIC_CAPS.quoteMax),
        passageId: passage?.id ?? null,
        chunkHash: passage?.hash ?? fact.chunkHash,
        role: "this",
        factId: fact.id,
        sourceId,
        sourceTitle: title,
    }
}

/** The fact of this document a line stands for: born from the line's passage and giving the same amount (or quoting the line). */
export const factOfLine = (line: CriticLine, facts: ReadonlyArray<CriticFact>): CriticFact | null => {
    const amount = moneyIn(line.text)[0]?.amount ?? null
    return (
        facts.find(
            (fact) =>
                (fact.chunkHash === null || fact.chunkHash === line.passage.hash) &&
                ((amount !== null && moneyOf(fact.value) === amount) ||
                    (fact.quote !== null && line.folded.includes(foldText(fact.quote)))),
        ) ?? null
    )
}

/** A button that names a value already written: pick that fact when there is one, else file the value. */
export const valueChoice = (id: "a" | "b", label: string, value: string, factId: string | null): CriticChoice => ({
    id,
    label,
    needsInput: false,
    inputHint: null,
    answer: { kind: factId === null ? "value" : "pick", factId, value },
})

/** A button that opens an input for the value. */
export const inputChoice = (id: "a" | "b", label: string, hint: string, factId: string | null): CriticChoice => ({
    id,
    label,
    needsInput: true,
    inputHint: hint,
    answer: { kind: "value", factId, value: null },
})

/** A button that turns the fact down (or the passage's rule, when no fact was filed). */
export const removeChoice = (id: "a" | "b", label: string, factId: string | null): CriticChoice => ({
    id,
    label,
    needsInput: false,
    inputHint: null,
    answer: { kind: "remove", factId, value: null },
})

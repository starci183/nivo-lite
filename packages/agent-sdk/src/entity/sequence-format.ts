import { EntityDefinitionError } from "./entity-error"

/** One piece of a parsed sequence format: owner text, the counter, or a date part of the creation day. */
export type SequencePart =
    | { readonly kind: "literal"; readonly text: string }
    | { readonly kind: "counter"; readonly width: number }
    | { readonly kind: "year" }
    | { readonly kind: "month" }
    | { readonly kind: "day" }

/** When a sequence counter restarts. */
export type SequenceReset = "day" | "month" | "year"

/** The calendar day a sequence value is minted on, in the workspace time zone (the caller zones it; the package does no time-zone maths). */
export interface SequenceDate {
    /** The year, 0..9999. */
    readonly year: number
    /** The month, 1..12. */
    readonly month: number
    /** The day of the month, 1..31. */
    readonly day: number
}

/** The longest format a sequence field declares. */
export const SEQUENCE_FORMAT_MAX = 100

/** The widest zero-padded counter. */
export const SEQUENCE_WIDTH_MAX = 12

const TOKEN = /\{([^{}]*)\}/g
const COUNTER = /^n:([1-9]\d?)$/

/** One token's content to its part, or undefined when it is not a known token. */
const tokenPart = (content: string): SequencePart | undefined => {
    if (content === "yyyy") return { kind: "year" }
    if (content === "mm") return { kind: "month" }
    if (content === "dd") return { kind: "day" }
    const counter = COUNTER.exec(content)
    if (counter === null) return undefined
    const width = Number(counter[1])
    return width <= SEQUENCE_WIDTH_MAX ? { kind: "counter", width } : undefined
}

/**
 * Parses a format such as `DH-{yyyy}{mm}{dd}-{n:4}` into its parts. A format is valid when it is at most 100 characters, holds
 * exactly one `{n:<1..12>}`, only the tokens `{yyyy}`, `{mm}` and `{dd}` besides, and no stray brace. Returns undefined otherwise.
 */
export const parseSequenceFormat = (format: string): ReadonlyArray<SequencePart> | undefined => {
    if (format.length === 0 || format.length > SEQUENCE_FORMAT_MAX) return undefined
    const parts: Array<SequencePart> = []
    let last = 0
    for (const match of format.matchAll(TOKEN)) {
        const part = tokenPart(match[0].slice(1, -1))
        if (part === undefined) return undefined
        if (match.index > last) parts.push({ kind: "literal", text: format.slice(last, match.index) })
        parts.push(part)
        last = match.index + match[0].length
    }
    if (last < format.length) parts.push({ kind: "literal", text: format.slice(last) })
    const counters = parts.filter((part) => part.kind === "counter").length
    const literals = parts.flatMap((part) => (part.kind === "literal" ? [part.text] : []))
    const strayBrace = literals.some((text) => text.includes("{") || text.includes("}"))
    return counters === 1 && !strayBrace ? parts : undefined
}

/** The date parts a counter that restarts per `resets` must show, or the value would repeat. */
const REQUIRED_PARTS: Readonly<Record<SequenceReset, ReadonlyArray<SequencePart["kind"]>>> = {
    day: ["year", "month", "day"],
    month: ["year", "month"],
    year: ["year"],
}

/**
 * Whether a sequence declaration is sound: the format parses, and a counter that restarts per day, month or year shows the date
 * parts of that period (else two periods would mint the same value).
 */
export const sequenceDeclarationValid = (format: string | undefined, resets: SequenceReset | undefined): boolean => {
    const parts = format === undefined ? undefined : parseSequenceFormat(format)
    if (parts === undefined) return false
    if (resets === undefined) return true
    return REQUIRED_PARTS[resets].every((kind) => parts.some((part) => part.kind === kind))
}

/** The period a counter belongs to: `""` for a counter that never restarts, else the year, month or day it counts in. */
export const sequencePeriodOf = (resets: SequenceReset | undefined, date: SequenceDate): string => {
    const year = String(date.year).padStart(4, "0")
    const month = String(date.month).padStart(2, "0")
    switch (resets) {
        case undefined:
            return ""
        case "year":
            return year
        case "month":
            return `${year}-${month}`
        case "day":
            return `${year}-${month}-${String(date.day).padStart(2, "0")}`
    }
}

const dateValid = (date: SequenceDate): boolean =>
    Number.isInteger(date.year) &&
    date.year >= 0 &&
    date.year <= 9999 &&
    Number.isInteger(date.month) &&
    date.month >= 1 &&
    date.month <= 12 &&
    Number.isInteger(date.day) &&
    date.day >= 1 &&
    date.day <= 31

const partText = (part: SequencePart, n: number, date: SequenceDate): string => {
    switch (part.kind) {
        case "literal":
            return part.text
        case "counter":
            return String(n).padStart(part.width, "0")
        case "year":
            return String(date.year).padStart(4, "0")
        case "month":
            return String(date.month).padStart(2, "0")
        case "day":
            return String(date.day).padStart(2, "0")
    }
}

/**
 * The display value of a sequence: `formatSequence("DH-{yyyy}{mm}{dd}-{n:4}", 42, { year: 2026, month: 11, day: 5 })` is
 * `DH-20261105-0042`. The counter is padded with zeros to its width and never truncated; the date parts are the ones the caller
 * read in the workspace time zone. Throws `EntityDefinitionError` for an invalid format, a counter that is not a non-negative safe
 * integer, or a date out of range.
 */
export const formatSequence = (format: string, n: number, date: SequenceDate): string => {
    const parts = parseSequenceFormat(format)
    if (parts === undefined) throw new EntityDefinitionError("ENTITY_SEQUENCE_FORMAT_INVALID", format)
    if (!Number.isSafeInteger(n) || n < 0) throw new EntityDefinitionError("ENTITY_SEQUENCE_VALUE_INVALID", `n=${n}`)
    if (!dateValid(date)) throw new EntityDefinitionError("ENTITY_SEQUENCE_VALUE_INVALID", "date")
    return parts.map((part) => partText(part, n, date)).join("")
}

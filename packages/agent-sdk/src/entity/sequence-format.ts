import { EntityDefinitionError } from "./entity-error"

/** One piece of a parsed sequence format: owner text, the counter, or a date part of the creation instant. */
export type SequencePart =
    | { readonly kind: "literal"; readonly text: string }
    | { readonly kind: "counter"; readonly width: number }
    | { readonly kind: "year" }
    | { readonly kind: "month" }

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
    const counter = COUNTER.exec(content)
    if (counter === null) return undefined
    const width = Number(counter[1])
    return width <= SEQUENCE_WIDTH_MAX ? { kind: "counter", width } : undefined
}

/**
 * Parses a format such as `DH-{yyyy}-{n:5}` into its parts. A format is valid when it is at most 100 characters, holds exactly one
 * `{n:<1..12>}`, only the tokens `{yyyy}` and `{mm}` besides, and no stray brace. Returns undefined for an invalid format.
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

const partText = (part: SequencePart, n: number, createdAt: Date): string => {
    switch (part.kind) {
        case "literal":
            return part.text
        case "counter":
            return String(n).padStart(part.width, "0")
        case "year":
            return String(createdAt.getUTCFullYear()).padStart(4, "0")
        case "month":
            return String(createdAt.getUTCMonth() + 1).padStart(2, "0")
    }
}

/**
 * The display value of a sequence: `formatSequence("DH-{yyyy}-{n:5}", 42, 2026-11-05)` is `DH-2026-00042`. The counter is padded
 * with zeros to its width and never truncated; the date parts are read in UTC. Throws `EntityDefinitionError` for an invalid
 * format, a counter that is not a non-negative safe integer, or an invalid date.
 */
export const formatSequence = (format: string, n: number, createdAt: Date): string => {
    const parts = parseSequenceFormat(format)
    if (parts === undefined) throw new EntityDefinitionError("ENTITY_SEQUENCE_FORMAT_INVALID", format)
    if (!Number.isSafeInteger(n) || n < 0) throw new EntityDefinitionError("ENTITY_SEQUENCE_VALUE_INVALID", `n=${n}`)
    if (Number.isNaN(createdAt.getTime())) throw new EntityDefinitionError("ENTITY_SEQUENCE_VALUE_INVALID", "createdAt")
    return parts.map((part) => partText(part, n, createdAt)).join("")
}

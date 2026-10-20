import type { Identity, LeadFlow, LeadSource, SourceWords } from "./lead-flows.contracts"

/** The flow fields that identify a prospect. */
export type FlowIdentity = Pick<LeadFlow, "psid" | "igsid" | "phone" | "email" | "connection_id">

/** Which key matched a flow. */
export type MatchedBy = "psid" | "igsid" | "phone" | "email"

/** A flow found for an identity, and the key that found it. */
export interface FlowMatch<R> {
    /** The flow. */
    readonly row: R
    /** The key. */
    readonly by: MatchedBy
}

/** The phone and email written in a text. */
export interface ContactFound {
    /** The phone, normalised. */
    readonly phone: string | null
    /** The email, lower case. */
    readonly email: string | null
}

const COMBINING_MARKS = /\p{M}/gu
const D_STROKE = new RegExp(String.fromCodePoint(0x0111), "g")

/** The trimmed text of a value, or "". */
export const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** The trimmed text of a value, or null when empty. */
export const textOrNull = (value: unknown): string | null => {
    const text = textOf(value)
    return text === "" ? null : text
}

/** At most `max` characters; a cut text ends with an ellipsis. */
export const clip = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** Lower case, no accents, single spaces. */
export const fold = (text: string): string =>
    text.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "").replace(D_STROKE, "d").replace(/\s+/g, " ").trim()

/** A Vietnamese phone as 84... digits, or null. */
export const normPhone = (raw: unknown): string | null => {
    const value = textOf(raw)
    if (value === "" || value.includes("@")) return null
    let digits = value.replace(/\D/g, "")
    if (digits.length < 8) return null
    if (digits.startsWith("0")) digits = `84${digits.slice(1)}`
    else if (!digits.startsWith("84") && digits.length === 9) digits = `84${digits}`
    return digits
}

/** The part at an index of a split, empty when the index is outside it. */
const partAt = (parts: ReadonlyArray<string>, index: number): string => parts.slice(index, index + 1).join("")

/** An email in lower case, or null. */
export const normEmail = (raw: unknown): string | null => {
    const value = textOf(raw).toLowerCase()
    const parts = value.split("@")
    const local = partAt(parts, 0)
    const domain = parts[1] ?? ""
    const dot = domain.lastIndexOf(".", domain.length - 2)
    return parts.length === 2 && local !== "" && dot > 0 && !/\s/.test(value) ? value : null
}

/** Finds the first adjacent address parts without retrying an unbounded regex at every character. */
const emailIn = (text: string): string | null => {
    for (const token of text.split(/[\s,;]+/)) {
        const parts = token.split("@")
        for (let index = 1; index < parts.length; index += 1) {
            const local = partAt(parts, index - 1)
            const domain = partAt(parts, index)
            if (local !== "" && domain.lastIndexOf(".", domain.length - 2) > 0) return `${local}@${domain}`
        }
    }
    return null
}

/** The first phone number and email written in a free text, normalised. */
export const contactIn = (text: string): ContactFound => {
    const email = emailIn(text)
    const phone = /(?:\+?84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}/.exec(text.replace(email ?? "", " "))?.[0] ?? null
    return { phone: normPhone(phone), email: normEmail(email) }
}

/**
 * The existing flow of a person, by the strongest key first: Messenger id, Instagram id, phone, email. A Messenger or Instagram id only
 * means something on the connection (Page) that issued it.
 */
export const matchFlow = <R extends FlowIdentity>(
    rows: ReadonlyArray<R>,
    id: Identity,
    connectionId: string | null,
): FlowMatch<R> | null => {
    const sameConnection = (row: R): boolean =>
        row.connection_id === null || connectionId === null || row.connection_id === connectionId
    const tries: ReadonlyArray<readonly [MatchedBy, (row: R) => boolean]> = [
        ["psid", (row) => id.psid !== null && row.psid === id.psid && sameConnection(row)],
        ["igsid", (row) => id.igsid !== null && row.igsid === id.igsid && sameConnection(row)],
        ["phone", (row) => id.phone !== null && row.phone === id.phone],
        ["email", (row) => id.email !== null && row.email === id.email],
    ]
    for (const [by, matches] of tries) {
        const row = rows.find(matches)
        if (row !== undefined) return { row, by }
    }
    return null
}

/** Only the identity keys the flow does not have yet: a key it has is never overwritten. */
export const identityPatch = (row: Identity, incoming: Identity): Partial<Identity> => ({
    ...(incoming.psid !== null && row.psid === null ? { psid: incoming.psid } : {}),
    ...(incoming.igsid !== null && row.igsid === null ? { igsid: incoming.igsid } : {}),
    ...(incoming.phone !== null && row.phone === null ? { phone: incoming.phone } : {}),
    ...(incoming.email !== null && row.email === null ? { email: incoming.email } : {}),
})

const touchKey = (source: LeadSource): string =>
    `${source.kind}:${source.comment_id ?? source.leadgen_id ?? source.form_id ?? source.ad_id ?? source.post_id ?? source.referral?.ref ?? "-"}`

/** Adds a touch once (the same kind on the same comment, lead, form, ad or post is one touch); at most the last 30. */
export const addTouch = (touches: ReadonlyArray<LeadSource>, source: LeadSource): Array<LeadSource> =>
    touches.some((touch) => touchKey(touch) === touchKey(source)) ? [...touches] : [...touches, source].slice(-30)

/** One line naming where a touch came from. */
export const sourceLine = (source: LeadSource | null, words: SourceWords): string =>
    [
        source?.platform === "instagram" ? "Instagram" : "Facebook",
        words.kind,
        source?.form_id ? `${words.form} ${source.form_id}` : null,
        source?.ad_id ? `${words.ad} ${source.ad_id}` : null,
        source?.post_id ? `${words.post} ${source.post_id}` : null,
        source?.referral?.ref ? `ref ${source.referral.ref}` : null,
    ]
        .filter((part): part is string => part !== null && part !== "")
        .join(" · ")

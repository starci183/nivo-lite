import { MAX_LINE } from "../../../shared/bounds"
import { sha256HexOf } from "./sha256.policy"

/** How many hex characters of the digest an occasion id keeps. */
const OCCASION_ID_LENGTH = 16

/** A date the customer mentioned, with the id a timer names it by. */
export interface LeadCareOccasion {
    /** Stable for the same label and date: what a care timer names as its `item`, so no node builds a suffix. */
    readonly occasionId: string
    /** What it is, in the customer's words. */
    readonly label: string
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
    /** The year, when the customer gave one that makes it a one-off; null for a yearly one. */
    readonly year: number | null
}

/** What care knows of one customer, as `nivo.tool.lead.care.get` answers it. */
export interface LeadCare {
    /** The customer. */
    readonly leadId: string
    /** True only when the customer asked not to be written to unprompted; anything unreadable is false. */
    readonly optedOut: boolean
    /** Who the purchase is for, or null. */
    readonly recipient: string | null
    /** When the customer wants the order, in their words, or null. */
    readonly deliveryAt: string | null
    /** Where to deliver, or null. */
    readonly address: string | null
    /** The dates the customer mentioned that read as a date. */
    readonly occasions: ReadonlyArray<LeadCareOccasion>
}

/** `MM-DD` (yearly) or `YYYY-MM-DD` (one-off). */
const DATE_SHAPE = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, MAX_LINE) : null

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The id of an occasion: a digest of its label and its date as written, so the same occasion keeps its id across reads. */
const occasionIdOf = (label: string, date: string): string =>
    sha256HexOf(`${label}\n${date}`).slice(0, OCCASION_ID_LENGTH)

const occasionOf = (value: unknown): LeadCareOccasion | null => {
    if (!isObject(value)) return null
    const label = textOf(value["label"])
    const written = textOf(value["date"])
    const date = DATE_SHAPE.exec(written ?? "")
    if (label === null || written === null || date === null) return null
    const month = Number(date[2])
    const day = Number(date[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return { occasionId: occasionIdOf(label, written), label, month, day, year: date[1] === undefined ? null : Number(date[1]) }
}

/**
 * What care reads from a customer's lead facts, however much of it is there: `careOptOut` counts only when it is `true`, the receiver is
 * read from `recipientName`, an occasion counts only with a label and a valid `MM-DD` / `YYYY-MM-DD` date, and anything unreadable is
 * "not known", never an opt-out. Each occasion gets a stable `occasionId`.
 */
export const leadCareOf = (leadId: string, stored: unknown): LeadCare => {
    if (!isObject(stored)) return { leadId, optedOut: false, recipient: null, deliveryAt: null, address: null, occasions: [] }
    const listed: ReadonlyArray<unknown> = Array.isArray(stored["occasions"]) ? stored["occasions"] : []
    return {
        leadId,
        optedOut: stored["careOptOut"] === true,
        recipient: textOf(stored["recipientName"]),
        deliveryAt: textOf(stored["deliveryAt"]),
        address: textOf(stored["address"]),
        occasions: listed.flatMap((entry) => {
            const occasion = occasionOf(entry)
            return occasion === null ? [] : [occasion]
        }),
    }
}

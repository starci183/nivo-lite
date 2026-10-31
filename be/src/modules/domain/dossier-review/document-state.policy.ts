import type { DocumentState } from "./dossier-inputs.contracts"

/** The lower-case, accent-free form of a text with one character per input character, so an index into it is an index into the original (NFC) text. */
export const foldKeepLength = (text: string): string =>
    text
        .split("")
        .map((unit) => unit.toLowerCase().replace("\u0111", "d").normalize("NFD").charAt(0))
        .join("")

/** The folded form of any text: NFC, accents removed, lower case, whitespace collapsed to single spaces. */
export const foldText = (text: string): string => foldKeepLength(text.normalize("NFC")).replace(/\s+/gu, " ").trim()

/** What names the dossier of a source: its tags and its title. */
export interface SourceNaming {
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** The title. */
    readonly title: string
}

/** What tells the state of a source: its tags, its title and where it came from. */
export interface SourceMarks extends SourceNaming {
    /** Where it came from. */
    readonly origin: string | null
}

const withoutLeadingZeros = (digits: string): string => digits.replace(/^0+(?=\d)/u, "")

/** The dossier reference a source files under: the number of its `dossier:<n>` tag, else the number its title starts with ("08. Report" is 8); null when it names none. Mirrors the SQL of the dossier counts. */
export const refOfSource = (source: SourceNaming): string | null => {
    for (const tag of source.tags) {
        const tagged = /^dossier:(\d+)$/u.exec(tag)
        if (tagged?.[1] !== undefined) return withoutLeadingZeros(tagged[1])
    }
    const titled = /^(\d+)\.\s/u.exec(source.title.trimStart())
    return titled?.[1] === undefined ? null : withoutLeadingZeros(titled[1])
}

const DRAFT_WORDS = /du thao|cho ky|draft/u
const TEMPLATE_WORDS = /_mau cu|bo mau|template|bieu mau/u

/** What the source is: a draft when tagged so or titled or sourced as one; a template when tagged so, sourced as one or titled like the template dossier; otherwise actual. */
export const stateOfSource = (source: SourceMarks, templateTitle: string | null): DocumentState => {
    const title = foldText(source.title)
    const origin = foldText(source.origin ?? "")
    if (source.tags.includes("nivo:draft") || source.tags.includes("draft")) return "draft"
    if (DRAFT_WORDS.test(title) || DRAFT_WORDS.test(origin)) return "draft"
    if (source.tags.includes("template") || TEMPLATE_WORDS.test(origin)) return "template"
    if (templateTitle !== null && title.replace(/^\d+\.\s*/u, "") === foldText(templateTitle)) return "template"
    return "actual"
}

const pad = (value: number): string => String(value).padStart(2, "0")

/** A calendar date as YYYY-MM-DD, or null when the parts are not a real date. */
export const isoDate = (year: number, month: number, day: number): string | null => {
    const at = new Date(Date.UTC(year, month - 1, day))
    const real = at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day
    return real ? `${year}-${pad(month)}-${pad(day)}` : null
}

/** The first date in a text written yyyy.mm.dd, yyyy-mm-dd, dd.mm.yyyy or dd/mm/yyyy; null when there is none. */
export const dateIn = (text: string): string | null => {
    const first = /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/u.exec(text)
    const last = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/u.exec(text)
    if (first !== null && (last === null || first.index <= last.index)) {
        return isoDate(Number(first[1]), Number(first[2]), Number(first[3]))
    }
    return last === null ? null : isoDate(Number(last[3]), Number(last[2]), Number(last[1]))
}

/** The date a source bears: the earliest of the given signing-type fact dates, else a date in its title; never the upload time. */
export const dateOfSource = (title: string, factDates: ReadonlyArray<string>): string | null =>
    [...factDates].sort((a, b) => a.localeCompare(b))[0] ?? dateIn(title)

/** Today plus a number of days, as YYYY-MM-DD. */
export const addDays = (date: string, days: number): string =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

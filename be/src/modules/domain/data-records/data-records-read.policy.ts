import type { MailAttachments, MailFullRow, MailHeadRow } from "./data-records-read.contracts"

/** A stored `imap.mail` row as a mail read maps it: its id, its mailbox, when it entered the store (text) and its value. */
export interface StoredMail {
    /** The row id. */
    readonly id: string
    /** The mailbox (connection) it was synced from. */
    readonly connectionId: string
    /** When the row entered the store, as the store wrote it (an ISO or a Postgres `timestamptz` text). */
    readonly createdAt: string
    /** The value, as `imap.mail` declares it. */
    readonly value: Readonly<Record<string, unknown>>
}

/** The parts of a `timestamptz` text: date, time, fraction digits, offset (`2026-11-11 10:00:00.12+00`, `2026-11-11T10:00:00.120Z`). */
const INSTANT_PARTS = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?([Z+-][\d:]*)?$/u

/** An offset as `Date` reads it (`+07` → `+07:00`, `+0530` → `+05:30`); seconds of an offset are dropped. */
const offsetOf = (raw: string | undefined): string => {
    if (raw === undefined || raw === "Z") return "Z"
    const digits = raw.slice(1).replaceAll(":", "")
    return `${raw.slice(0, 1)}${digits.slice(0, 2)}:${digits.slice(2, 4).padEnd(2, "0")}`
}

/**
 * An instant written fixed-width in UTC with microseconds (`2026-11-11T10:00:00.123000Z`), so two of them compare by code unit in time
 * order (Postgres drops trailing zeros of a fraction and writes the session's offset: its text is not fixed-width). A text that is no
 * instant is answered as it is.
 */
export const fixedInstantOf = (text: string): string => {
    const parts = INSTANT_PARTS.exec(text)
    const day = parts?.[1]
    const time = parts?.[2]
    if (parts === null || day === undefined || time === undefined) return text
    const at = new Date(`${day}T${time}${offsetOf(parts[4])}`)
    if (Number.isNaN(at.getTime())) return text
    return `${at.toISOString().slice(0, 19)}.${(parts[3] ?? "").padEnd(6, "0")}Z`
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The attachments of a mail value as a list (an absent or odd member is none). */
const attachmentListOf = (value: Readonly<Record<string, unknown>>): ReadonlyArray<unknown> =>
    Array.isArray(value.attachments) ? value.attachments : []

/** The attachments of a mail as name, type and size: without the text the sync kept of a small XML (an e-invoice). */
export const attachmentsWithoutTextOf = (value: Readonly<Record<string, unknown>>): ReadonlyArray<unknown> =>
    attachmentListOf(value).map((entry) =>
        isObject(entry) ? Object.fromEntries(Object.entries(entry).filter(([name]) => name !== "xml")) : entry,
    )

/** True when one attachment of the mail kept the text of an XML file (`xml`), what the e-invoice tools read. */
export const carriesXml = (value: Readonly<Record<string, unknown>>): boolean =>
    attachmentListOf(value).some((entry) => isObject(entry) && "xml" in entry)

/** The members of a mail value that are no part of its head: the text, the attachments, the store's own key and the date. */
const NOT_HEAD: ReadonlySet<string> = new Set(["text", "attachments", "externalId", "date"])

/** The head of a mail value: what the hub row's `data` held minus the text and the attachments (`from`, `to`, `subject`, ...). */
const headOf = (value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
    Object.fromEntries(Object.entries(value).filter(([name]) => !NOT_HEAD.has(name)))

/** When the mail was sent (or received), or null when the sync knew no date. */
const occurredAtOf = (value: Readonly<Record<string, unknown>>): string | null =>
    typeof value.date === "string" ? value.date : null

/** The text of a mail value, or null when it holds none. */
const textOf = (value: Readonly<Record<string, unknown>>): string | null =>
    typeof value.text === "string" ? value.text : null

/** The fields every mail read carries of a stored mail. */
const baseOf = (mail: StoredMail): Omit<MailHeadRow, "opening"> => ({
    id: mail.id,
    seenAt: fixedInstantOf(mail.createdAt),
    connectionId: mail.connectionId,
    occurredAt: occurredAtOf(mail.value),
    head: headOf(mail.value),
    attachments: attachmentsWithoutTextOf(mail.value),
})

/** A stored mail as a list reads it: the head and the first `opening` characters of its text. */
export const mailHeadRowOf = (mail: StoredMail, opening: number): MailHeadRow => {
    const text = textOf(mail.value)
    return { ...baseOf(mail), opening: text === null ? null : text.slice(0, opening) }
}

/** A stored mail read whole: the head and the text the sync kept. */
export const mailFullRowOf = (mail: StoredMail): MailFullRow => ({ ...baseOf(mail), text: textOf(mail.value) })

/** A stored mail with the attachments the sync kept on it, XML text included. */
export const mailAttachmentsOf = (mail: Pick<StoredMail, "id" | "value">): MailAttachments => ({
    id: mail.id,
    attachments: attachmentListOf(mail.value),
})

/** The uuid shape of a row id: an id of any other shape names no row. */
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

/** True when the text has the shape of a row id. */
export const isRowId = (text: string): boolean => UUID.test(text)

/** The newest first order of mails by date, a mail with no date last. */
export const byDateNewestFirst = (left: Pick<StoredMail, "value">, right: Pick<StoredMail, "value">): number => {
    const a = occurredAtOf(left.value)
    const b = occurredAtOf(right.value)
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return Date.parse(b) - Date.parse(a)
}

/** True when the mail is dated on or after the day (`YYYY-MM-DD`, UTC); an undated mail is before every day. */
export const datedFrom = (value: Readonly<Record<string, unknown>>, day: string): boolean => {
    const at = occurredAtOf(value)
    return at !== null && Date.parse(at) >= Date.parse(`${day}T00:00:00.000Z`)
}

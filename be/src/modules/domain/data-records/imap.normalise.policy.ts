import type { DataRecordInput } from "./data-records.contracts"
import {
    IMAP_FOLDER_MAX,
    IMAP_HEADER_ID_MAX,
    IMAP_MAIL_ID_MAX,
    IMAP_MAIL_TEXT_MAX,
    IMAP_MAIL_TYPE,
    IMAP_SUBJECT_MAX,
} from "./imap.data-types"

/** The value of one `imap.mail` row: exactly the declared fields. */
export type ImapMailValue = Readonly<Record<string, unknown>>

/** A mail value, or null when the sync's row cannot be kept. */
export type OptionalImapMailValue = ImapMailValue | null

/** One `imap.mail` row for the account's intake. */
export interface ImapMailInput {
    /** Always `imap.mail`. */
    readonly type: typeof IMAP_MAIL_TYPE
    /** The mail's value, exactly the declared fields. */
    readonly value: ImapMailValue
}

const textOr = (value: unknown, fallback: string): string => (typeof value === "string" ? value : fallback)

/** The members whose value is a text when the sync wrote one, cut to `max`; absent otherwise (a null header id is no member). */
const optionalText = (name: string, value: unknown, max: number): Readonly<Record<string, string>> =>
    typeof value === "string" ? { [name]: value.slice(0, max) } : {}

const optionalBoolean = (name: string, value: unknown): Readonly<Record<string, boolean>> =>
    typeof value === "boolean" ? { [name]: value } : {}

const optionalJson = (name: string, value: unknown): Readonly<Record<string, unknown>> =>
    value === undefined || value === null ? {} : { [name]: value }

/** The ISO instant of the mail's date, or none when the sync knew none (or it is no date). */
const dateOf = (value: DataRecordInput["occurredAt"]): Readonly<Record<string, string>> => {
    if (value === undefined || value === null) return {}
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? {} : { date: date.toISOString() }
}

/** The IMAP UID of a row: the integer the sync wrote, else the last part of its id; null when neither is one. */
const uidOf = (row: DataRecordInput): number | null => {
    const written = row.data.uid
    if (typeof written === "number" && Number.isInteger(written) && written >= 0) return written
    const last = Number(row.externalId.slice(row.externalId.lastIndexOf(":") + 1))
    return Number.isInteger(last) && last >= 0 ? last : null
}

/**
 * One mail row of the IMAP sync as the `imap.mail` value: the head, the text (cut to the declared 20 KB), the attachments, the date.
 * The hub row's `title` is not kept: it is the subject (both are the parsed `Subject`, or empty). Null when the row has no usable id
 * (empty, or longer than the hub kept) or no UID, so one odd row never refuses its batch.
 */
export const imapMailValueOf = (row: DataRecordInput): OptionalImapMailValue => {
    const externalId = String(row.externalId)
    const uid = uidOf(row)
    if (externalId === "" || externalId.length > IMAP_MAIL_ID_MAX || uid === null) return null
    const data = row.data
    const attachments = Array.isArray(data.attachments) ? data.attachments : []
    return {
        externalId,
        folder: textOr(data.folder, externalId.split(":", 1).join("")).slice(0, IMAP_FOLDER_MAX),
        uid,
        ...dateOf(row.occurredAt),
        ...optionalJson("from", data.from),
        ...optionalJson("to", data.to),
        ...optionalJson("cc", data.cc),
        subject: textOr(data.subject, row.title ?? "").slice(0, IMAP_SUBJECT_MAX),
        text: textOr(data.text, "").slice(0, IMAP_MAIL_TEXT_MAX),
        ...optionalBoolean("truncated", data.truncated),
        ...optionalBoolean("unreadable", data.unreadable),
        attachments,
        ...optionalText("messageId", data.messageId, IMAP_HEADER_ID_MAX),
        ...optionalText("inReplyTo", data.inReplyTo, IMAP_HEADER_ID_MAX),
    }
}

/** The `imap.mail` inputs of a batch of the IMAP sync's rows, in order; a row with no usable id is left out (as the hub skipped it). */
export const imapMailInputsOf = (rows: ReadonlyArray<DataRecordInput>): ReadonlyArray<ImapMailInput> =>
    rows.flatMap((row) => {
        const value = imapMailValueOf(row)
        return value === null ? [] : [{ type: IMAP_MAIL_TYPE, value }]
    })

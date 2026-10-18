import type { AddressObject, ParsedMail } from "mailparser"
import type { ImapAddress, ImapMessageRow } from "./imap-mailbox.contracts"

/** The most text kept from one message. */
export const IMAP_MAX_TEXT = 20 * 1024

/** The folder cursor `<uidvalidity>:<uid>`, parsed. */
export interface ImapCursor {
    /** The folder's UIDVALIDITY when the cursor was saved. */
    readonly validity: string
    /** The highest UID already read. */
    readonly uid: number
}

/** Parses a saved folder cursor; null when absent or malformed. */
export const parseImapCursor = (value: string | null): ImapCursor | null => {
    const match = /^(\d+):(\d+)$/u.exec(value ?? "")
    const validity = match?.[1]
    const uid = match?.[2]
    return validity === undefined || uid === undefined ? null : { validity, uid: Number(uid) }
}

/** Writes a folder cursor. */
export const formatImapCursor = (validity: string, uid: number): string => `${validity}:${uid}`

const addresses = (value: AddressObject | Array<AddressObject> | undefined): Array<ImapAddress> => {
    if (value === undefined) return []
    const list = Array.isArray(value) ? value.flatMap((entry) => entry.value) : value.value
    return list.map((entry) => ({
        name: entry.name === "" ? null : entry.name,
        address: entry.address === undefined || entry.address === "" ? null : entry.address,
    }))
}

const stripBlocks = (html: string): string => {
    const lower = html.replaceAll(/[A-Z]/gu, (letter) => letter.toLowerCase()).replaceAll("ſ", "s")
    const ends = { script: lower.indexOf("</script>"), style: lower.indexOf("</style>") }
    const parts: Array<string> = []
    let start = 0
    for (let index = 0; index < html.length; index++) {
        if (html[index] !== "<") continue
        const kind = lower.startsWith("script", index + 1) ? "script" : "style"
        if (!lower.startsWith(kind, index + 1)) continue
        if (ends[kind] >= 0 && ends[kind] < index) ends[kind] = lower.indexOf(`</${kind}>`, index)
        if (ends[kind] < 0) continue
        parts.push(html.slice(start, index), " ")
        index = ends[kind] + kind.length + 2
        start = index + 1
    }
    parts.push(html.slice(start))
    return parts.join("")
}

const stripTags = (withoutBlocks: string): string => {
    const text: Array<string> = []
    let start = 0
    let open = withoutBlocks.indexOf("<")
    while (open >= 0) {
        const end = withoutBlocks.indexOf(">", open + 1)
        if (end < 0) break
        if (end > open + 1) {
            text.push(withoutBlocks.slice(start, open), " ")
            start = end + 1
        }
        open = withoutBlocks.indexOf("<", end + 1)
    }
    text.push(withoutBlocks.slice(start))
    return text.join("")
}

const stripHtml = (html: string): string =>
    stripTags(stripBlocks(html))
        .replaceAll("&nbsp;", " ")
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replace(/\s+/gu, " ")
        .trim()

type MailDate = Date | string | null | undefined

const validDate = (value: MailDate): Date | null => {
    if (value === null || value === undefined) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

/** One parsed email as a hub row: 20 KB of text, attachments as name/type/size only. */
export const messageToRow = (
    folder: string,
    uidValidity: string,
    uid: number,
    mail: ParsedMail,
    fallbackDate: MailDate,
): ImapMessageRow => {
    const body = (mail.text ?? (typeof mail.html === "string" ? stripHtml(mail.html) : "")).trim()
    return {
        externalId: `${folder}:${uidValidity}:${uid}`,
        title: mail.subject ?? "",
        occurredAt: validDate(mail.date) ?? validDate(fallbackDate),
        data: {
            folder,
            uid,
            from: addresses(mail.from),
            to: addresses(mail.to),
            cc: addresses(mail.cc),
            subject: mail.subject ?? "",
            text: body.slice(0, IMAP_MAX_TEXT),
            truncated: body.length > IMAP_MAX_TEXT,
            attachments: mail.attachments.map((attachment) => ({
                name: attachment.filename ?? null,
                type: attachment.contentType,
                size: attachment.size,
            })),
            messageId: mail.messageId ?? null,
            inReplyTo: mail.inReplyTo ?? null,
        },
    }
}

/** The row for a message that could not be parsed. */
export const unreadableRow = (
    folder: string,
    uidValidity: string,
    uid: number,
    fallbackDate: MailDate,
): ImapMessageRow => ({
    externalId: `${folder}:${uidValidity}:${uid}`,
    title: "",
    occurredAt: validDate(fallbackDate),
    data: { folder, uid, subject: "", text: "", unreadable: true, attachments: [] },
})

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

const stripHtml = (html: string): string =>
    html
        .replace(/<(script|style)[\s\S]*?<\/\1>/giu, " ")
        .replace(/<[^>]+>/gu, " ")
        .replace(/&nbsp;/gu, " ")
        .replace(/&amp;/gu, "&")
        .replace(/&lt;/gu, "<")
        .replace(/&gt;/gu, ">")
        .replace(/\s+/gu, " ")
        .trim()

const validDate = (value: Date | string | null | undefined): Date | null => {
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
    fallbackDate: Date | string | null | undefined,
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
    fallbackDate: Date | string | null | undefined,
): ImapMessageRow => ({
    externalId: `${folder}:${uidValidity}:${uid}`,
    title: "",
    occurredAt: validDate(fallbackDate),
    data: { folder, uid, subject: "", text: "", unreadable: true, attachments: [] },
})

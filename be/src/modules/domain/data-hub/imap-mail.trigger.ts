import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"
import { IMAP_MAIL_ROW_SCHEMA, MAIL_RECEIVED_DATA_SCHEMA } from "./imap-mail.schema"

/*
 * THE MAILBOX'S TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): one mail the IMAP sync kept as a NEW `imap.mail` row
 * (the inbox: keyed by `<folder>:<uidvalidity>:<uid>`), as ONE canonical event. Pure: the translate reads only its argument. The event
 * carries the mail's ids and its time, never its words: a workflow reads the mail through the mail tool. No key: every mail its own run.
 */

/** The trigger's name inside the provider. */
export const MAIL_RECEIVED = "mail.received"

/** The members of the stored `imap.mail` row value the translate reads (data-records imap.data-types.ts `imapMail`). */
export type ImapMailRow = {
    /** The mail's id in the inbox, `<folder>:<uidvalidity>:<uid>`. */
    readonly externalId: string
    /** The mailbox folder the mail sits in. */
    readonly folder: string
    /** The mail's UID inside its folder. */
    readonly uid: number
    /** When the mail was sent, as ISO text. */
    readonly date?: string | null | undefined
    /** The mail's `Message-ID` header. */
    readonly messageId?: string | null | undefined
}

/** The data of one mail: its id in the mailbox, its folder, when it was sent, its `Message-ID`. */
export type MailReceivedData = {
    /** The mail's id in the mailbox. */
    readonly mailId: string
    /** The mailbox folder the mail sits in. */
    readonly folder: string
    /** When the mail was sent, as ISO text. */
    readonly at?: string | undefined
    /** The mail's `Message-ID` header. */
    readonly messageId?: string | undefined
}

/** The translate: one event per stored mail. */
export const translateImapMailRow = (row: ImapMailRow): OptionalCanonicalEvent<MailReceivedData> => {
    if (row.externalId === "") return null
    return {
        id: row.externalId,
        data: {
            mailId: row.externalId,
            folder: row.folder,
            ...(typeof row.date === "string" ? { at: row.date } : {}),
            ...(typeof row.messageId === "string" && row.messageId !== "" ? { messageId: row.messageId } : {}),
        },
    }
}

/** The mailbox's declaration: received by the sync's poll. */
export const IMAP_MAIL_TRIGGER: TriggerDeclaration<ImapMailRow, MailReceivedData> = {
    provider: PROVIDER.imap,
    name: MAIL_RECEIVED,
    verb: TRIGGER.mailMessageReceived,
    via: "poll",
    raw: IMAP_MAIL_ROW_SCHEMA,
    data: MAIL_RECEIVED_DATA_SCHEMA,
    translate: translateImapMailRow,
    key: { by: "none" },
    settle: null,
}

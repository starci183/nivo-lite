import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The provider of a workspace's own sender, as `connections.provider` names it. */
export const SMTP_PROVIDER = "smtp"

/** The name of the type of one send through a workspace's SMTP connection. */
export const SMTP_MAIL_TYPE = "smtp.mail"

/** The names of the credential members of an SMTP connection, in the spellings the code uses (`password` sealed, `pass` handed to the relay). */
const SMTP_SECRET_FIELDS: ReadonlyArray<string> = ["password", "pass"]

/**
 * One send attempt through a workspace's own SMTP connection, keyed by its `email_messages` row id, kept for good: to whom, what about,
 * why, how it went and the server's message id. No body, no attachment, no credential: `email_messages` stays the send ledger, this is the
 * account's own memory of what went through it.
 */
export const smtpMail: AccountDataTypeDef = defineAccountDataType({
    name: SMTP_MAIL_TYPE,
    provider: SMTP_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        emailMessageId: { type: "text", required: true, maxLength: 64 },
        at: { type: "timestamp", required: true },
        to: { type: "text", required: true, maxLength: 254 },
        subject: { type: "text", required: true, maxLength: 300 },
        status: { type: "text", required: true, maxLength: 40 },
        purpose: { type: "text", required: true, maxLength: 60 },
        providerMessageId: { type: "text", required: false, maxLength: 1000 },
    },
    key: ["emailMessageId"],
    occurredAt: "at",
    wakes: false,
    retention: "keep",
    indexes: [],
    secretFields: SMTP_SECRET_FIELDS,
    purpose: "mail.sent",
})

/** Every account data type of an SMTP connection, for the catalog. */
export const SMTP_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [smtpMail]

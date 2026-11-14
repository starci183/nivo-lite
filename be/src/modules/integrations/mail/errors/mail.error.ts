import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the mail integration: why a send failed, in terms the owner can act on. */
export enum MailErrorCode {
    /** The username or password was refused. */
    Auth = "MAIL_AUTH",
    /** The provider wants an application password. */
    AppPassword = "MAIL_APP_PASSWORD",
    /** The mail server could not be reached. */
    Connect = "MAIL_CONNECT",
    /** The mail server did not answer in time. */
    Timeout = "MAIL_TIMEOUT",
    /** The server name does not exist. */
    Dns = "MAIL_DNS",
    /** The secure connection failed. */
    Tls = "MAIL_TLS",
    /** The server refuses the sender address. */
    Sender = "MAIL_SENDER",
    /** The server refused the recipient address. */
    Recipient = "MAIL_RECIPIENT",
    /** The provider's sending limit was reached, or an attachment is too large. */
    Limit = "MAIL_LIMIT",
    /** The server refused the message for a reason this client does not know. */
    Unknown = "MAIL_UNKNOWN",
    /** The address is not a mailbox the mail integration sends to. */
    AddressInvalid = "MAIL_ADDRESS_INVALID",
    /** The message is not one the mail integration sends: no subject, no text, a body or an attachment over the limit. */
    MessageInvalid = "MAIL_MESSAGE_INVALID",
}

/** How each mail code travels. */
export const MAIL_ERROR_KINDS: Record<MailErrorCode, ErrorKind> = {
    [MailErrorCode.Auth]: "invalid",
    [MailErrorCode.AppPassword]: "invalid",
    [MailErrorCode.Connect]: "unavailable",
    [MailErrorCode.Timeout]: "unavailable",
    [MailErrorCode.Dns]: "invalid",
    [MailErrorCode.Tls]: "unavailable",
    [MailErrorCode.Sender]: "invalid",
    [MailErrorCode.Recipient]: "invalid",
    [MailErrorCode.Limit]: "rate-limited",
    [MailErrorCode.Unknown]: "unavailable",
    [MailErrorCode.AddressInvalid]: "invalid",
    [MailErrorCode.MessageInvalid]: "invalid",
}

/** The one error class of the mail integration; the server's own words ride in the `detail` param. */
export class MailError extends DomainError<MailErrorCode> {}

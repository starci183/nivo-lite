import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the email-messages capability. */
export enum EmailMessagesErrorCode {
    /** The insert answered no row: the send attempt was not recorded. */
    NotRecorded = "EMAIL_MESSAGES_NOT_RECORDED",
    /** The SMTP form is not one the wizard offers, or something unexpected went wrong. */
    SmtpInvalid = "EMAIL_MESSAGES_SMTP_INVALID",
    /** The SMTP server name is missing. */
    SmtpHost = "EMAIL_MESSAGES_SMTP_HOST",
    /** The SMTP port is not a valid number. */
    SmtpPort = "EMAIL_MESSAGES_SMTP_PORT",
    /** The sender name, sender email, username or password is missing. */
    SmtpFields = "EMAIL_MESSAGES_SMTP_FIELDS",
    /** An email address is not valid. */
    SmtpEmail = "EMAIL_MESSAGES_SMTP_EMAIL",
    /** The new password is missing or unreadable. */
    SmtpPassword = "EMAIL_MESSAGES_SMTP_PASSWORD",
    /** The SMTP connection does not exist in the workspace. */
    SmtpNone = "EMAIL_MESSAGES_SMTP_NONE",
    /** The SMTP connection has not passed a test email yet. */
    SmtpNotConnected = "EMAIL_MESSAGES_SMTP_NOT_CONNECTED",
}

/** How each email-messages code travels. */
export const EMAIL_MESSAGES_ERROR_KINDS: Record<EmailMessagesErrorCode, ErrorKind> = {
    [EmailMessagesErrorCode.NotRecorded]: "internal",
    [EmailMessagesErrorCode.SmtpInvalid]: "invalid",
    [EmailMessagesErrorCode.SmtpHost]: "invalid",
    [EmailMessagesErrorCode.SmtpPort]: "invalid",
    [EmailMessagesErrorCode.SmtpFields]: "invalid",
    [EmailMessagesErrorCode.SmtpEmail]: "invalid",
    [EmailMessagesErrorCode.SmtpPassword]: "invalid",
    [EmailMessagesErrorCode.SmtpNone]: "not-found",
    [EmailMessagesErrorCode.SmtpNotConnected]: "invalid",
}

/** The one error class of the email-messages capability. */
export class EmailMessagesError extends DomainError<EmailMessagesErrorCode> {}

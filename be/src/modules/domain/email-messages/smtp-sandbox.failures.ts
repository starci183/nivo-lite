// NEED (integrations owner): export `MailErrorCode` from the mail index; until then the enum is read from its file (the same `MailError` class).
import { MailError, MailErrorCode } from "@modules/integrations/mail/errors/mail.error"

/** What the sandbox says in the `detail` of a refusal: a server's words, never a real server. */
const RECIPIENT_DETAIL = "550 5.1.1 Recipient address rejected (sandbox)"
const AUTH_DETAIL = "535 5.7.8 Username and Password not accepted (sandbox)"
const TIMEOUT_DETAIL = "sandbox: no answer in time"

const failureOf = (code: MailErrorCode, detail: string): MailError => new MailError({ code, params: { detail } })

/** The server refused the recipient: the `MailError` the live relay throws (`MAIL_RECIPIENT`, invalid). */
export const smtpRecipientRefused = (): MailError => failureOf(MailErrorCode.Recipient, RECIPIENT_DETAIL)

/** The server refused the login: the live `MAIL_AUTH`. */
export const smtpAuthRefused = (): MailError => failureOf(MailErrorCode.Auth, AUTH_DETAIL)

/** The server never answered: the live `MAIL_TIMEOUT` (the outcome is unknown, as live). */
export const smtpTimedOut = (): MailError => failureOf(MailErrorCode.Timeout, TIMEOUT_DETAIL)

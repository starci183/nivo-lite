import { MailError as PackageMailError } from "@starci/mail"
import type { MailErrorCode as PackageMailErrorCode } from "@starci/mail"
import { MailError, MailErrorCode } from "./errors/mail.error"

/** Every wire code of the package, and the code of the integration that carries it: a code the package adds fails the build here. */
const CODES: Readonly<Record<PackageMailErrorCode, MailErrorCode>> = {
    MAIL_AUTH: MailErrorCode.Auth,
    MAIL_APP_PASSWORD: MailErrorCode.AppPassword,
    MAIL_CONNECT: MailErrorCode.Connect,
    MAIL_TIMEOUT: MailErrorCode.Timeout,
    MAIL_DNS: MailErrorCode.Dns,
    MAIL_TLS: MailErrorCode.Tls,
    MAIL_SENDER: MailErrorCode.Sender,
    MAIL_RECIPIENT: MailErrorCode.Recipient,
    MAIL_LIMIT: MailErrorCode.Limit,
    MAIL_UNKNOWN: MailErrorCode.Unknown,
    MAIL_ADDRESS_INVALID: MailErrorCode.AddressInvalid,
    MAIL_MESSAGE_INVALID: MailErrorCode.MessageInvalid,
}

/**
 * Maps what a send threw to the integration's own error: a `@starci/mail` failure keeps its wire code and carries the server's
 * words in `detail`, anything else is unknown. The integration's own error passes through as it is.
 */
export const mailErrorOf = (cause: unknown): MailError => {
    if (cause instanceof MailError) return cause
    if (cause instanceof PackageMailError) {
        return new MailError({ code: CODES[cause.code], params: { detail: cause.detail }, cause })
    }
    return new MailError({ code: MailErrorCode.Unknown, params: { detail: "" }, cause })
}

import { MailError as PackageMailError } from "@starci/mail"
import { MailError, MailErrorCode } from "./errors/mail.error"

const CODES: ReadonlyMap<string, MailErrorCode> = new Map(
    Object.values(MailErrorCode).map((code): [string, MailErrorCode] => [code, code]),
)

/**
 * Maps what a send threw to the integration's own error: a `@starci/mail` failure keeps its wire code and carries the server's
 * words in `detail`, anything else is unknown. The integration's own error passes through as it is.
 */
export const mailErrorOf = (cause: unknown): MailError => {
    if (cause instanceof MailError) return cause
    if (cause instanceof PackageMailError) {
        return new MailError({ code: CODES.get(cause.code) ?? MailErrorCode.Unknown, params: { detail: cause.detail }, cause })
    }
    return new MailError({ code: MailErrorCode.Unknown, params: { detail: "" }, cause })
}

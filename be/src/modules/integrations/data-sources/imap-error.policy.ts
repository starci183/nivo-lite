import { IMAP_TEXT, VIETNAMESE_LETTER } from "./messages/imap.messages"

/** A plain-language reason for a mailbox failure and whether the server refused the request (rather than being unreachable). */
export interface ImapFailure {
    /** The sentence shown to the owner. */
    readonly detail: string
    /** True when the server answered and refused (a login, a setting), false when it could not be reached. */
    readonly rejected: boolean
}

const field = (error: unknown, key: string): string => {
    if (typeof error !== "object" || error === null) return ""
    const value: unknown = Reflect.get(error, key)
    return typeof value === "string" ? value : ""
}

const refusal = (detail: string): ImapFailure => ({ detail, rejected: true })
const unreachable = (detail: string): ImapFailure => ({ detail, rejected: false })

const byCode = (code: string): ImapFailure | null => {
    switch (code) {
        case "ENOTFOUND":
            return unreachable(IMAP_TEXT.hostNotFound)
        case "ECONNREFUSED":
            return unreachable(IMAP_TEXT.refused)
        case "CONNECT_TIMEOUT":
        case "GREETING_TIMEOUT":
        case "ETIMEDOUT":
        case "ETIMEOUT":
            return unreachable(IMAP_TEXT.timeout)
        case "ClosedAfterConnectTLS":
        case "ECONNRESET":
            return unreachable(IMAP_TEXT.secureFailed)
        case "ERR_TLS_CERT_ALTNAME_INVALID":
        case "CERT_HAS_EXPIRED":
        case "DEPTH_ZERO_SELF_SIGNED_CERT":
        case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
            return refusal(IMAP_TEXT.certInvalid)
        case "STARTTLS_INJECTION":
        case "UPGRADE_TIMEOUT":
            return unreachable(IMAP_TEXT.starttlsFailed)
        default:
            return null
    }
}

/** Turns whatever the IMAP library threw into a plain-language sentence. */
export const describeImapError = (error: unknown): ImapFailure => {
    if (error instanceof Error && VIETNAMESE_LETTER.test(error.message)) return refusal(error.message)
    const text = `${field(error, "responseText")} ${field(error, "response")} ${field(error, "message")}`
    const authFailed =
        typeof error === "object" && error !== null && Reflect.get(error, "authenticationFailed") === true
    if (
        authFailed ||
        /AUTHENTICATIONFAILED|invalid credentials|authentication failed|LOGIN failed|Invalid login/iu.test(text)
    ) {
        return refusal(
            /application-specific|app password|web login required|ALERT/iu.test(text)
                ? IMAP_TEXT.appPassword
                : IMAP_TEXT.wrongLogin,
        )
    }
    if (/IMAP.*(disabled|not enabled)|not allowed|access.*disabled|IMAP access/iu.test(text)) {
        return refusal(IMAP_TEXT.imapDisabled)
    }
    const coded = byCode(field(error, "code"))
    if (coded !== null) return coded
    if (/mailbox.*(not exist|does not exist)|NONEXISTENT|Unknown Mailbox/iu.test(text)) {
        return refusal(IMAP_TEXT.folderMissing)
    }
    return unreachable(IMAP_TEXT.generic)
}

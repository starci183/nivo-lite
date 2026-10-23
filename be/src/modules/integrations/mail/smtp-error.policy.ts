import { MailError, MailErrorCode } from "./errors/mail.error"

interface SmtpFailureShape {
    readonly code?: string | undefined
    readonly responseCode?: number | undefined
    readonly response?: string | undefined
    readonly message?: string | undefined
}

const shapeOf = (error: unknown): SmtpFailureShape => {
    if (typeof error !== "object" || error === null) return {}
    const field = (name: string): unknown => Reflect.get(error, name)
    const text = (name: string): string | undefined => {
        const value = field(name)
        return typeof value === "string" ? value : undefined
    }
    const responseCode = field("responseCode")
    return {
        code: text("code"),
        responseCode: typeof responseCode === "number" ? responseCode : undefined,
        response: text("response"),
        message: text("message"),
    }
}

const failure = (code: MailErrorCode, detail: string, cause: unknown): MailError =>
    new MailError({ code, params: { detail }, cause })

/** Maps a nodemailer or SMTP failure to what the owner should do about it. A MailError passes through as it is. */
export const classifySmtpFailure = (error: unknown): MailError => {
    if (error instanceof MailError) return error
    const shape = shapeOf(error)
    const text = `${shape.response ?? ""} ${shape.message ?? ""}`.slice(0, 300)
    const detail = text.replace(/\s+/gu, " ").trim()
    const fail = (code: MailErrorCode): MailError => failure(code, detail, error)
    if (
        shape.code === "EAUTH" ||
        shape.responseCode === 535 ||
        shape.responseCode === 534 ||
        /authentication|credentials|username and password/iu.test(text)
    ) {
        return fail(
            /application-specific|app password|5\.7\.9|apppasswords/iu.test(text)
                ? MailErrorCode.AppPassword
                : MailErrorCode.Auth,
        )
    }
    if (
        shape.code === "ETIMEDOUT" ||
        shape.code === "ECONNTIMEOUT" ||
        /timed? ?out|greeting never received/iu.test(text)
    ) {
        return fail(MailErrorCode.Timeout)
    }
    if (shape.code === "ENOTFOUND" || shape.code === "EDNS" || /getaddrinfo|ENOTFOUND/iu.test(text)) {
        return fail(MailErrorCode.Dns)
    }
    if (
        shape.code === "ECONNREFUSED" ||
        shape.code === "ECONNECTION" ||
        shape.code === "ECONNRESET" ||
        shape.code === "EHOSTUNREACH"
    ) {
        return fail(MailErrorCode.Connect)
    }
    if (
        /certificate|ssl|tls|wrong version number|handshake|self[- ]signed|STARTTLS/iu.test(text) ||
        shape.code === "ESOCKET"
    ) {
        return fail(MailErrorCode.Tls)
    }
    if (shape.code === "EENVELOPE" || /recipient|user unknown|mailbox unavailable|no such user/iu.test(text)) {
        const senderWords = /sender|from|send as|not (owned|allowed|permitted)|5\.7\.60|not authenticated|relay/iu
        const recipientWords = /recipient|user unknown/iu
        return fail(
            senderWords.test(text) && !recipientWords.test(text) ? MailErrorCode.Sender : MailErrorCode.Recipient,
        )
    }
    if (
        /sender|send as|not (owned|allowed|permitted) |5\.7\.60|553|relay access denied|domain.*not verified|not verified/iu.test(
            text,
        )
    ) {
        return fail(MailErrorCode.Sender)
    }
    if (/rate|limit|quota|too many|exceeded|4\.2\.1|452/iu.test(text)) return fail(MailErrorCode.Limit)
    return fail(MailErrorCode.Unknown)
}

import { MailError as PackageMailError } from "@starci/mail"
import { MailError, MailErrorCode } from "./errors/mail.error"
import { mailErrorOf } from "./mail-error.policy"

describe("mail-error policy / mailErrorOf", () => {
    it("lets the integration's own error through as it is", () => {
        const own = new MailError({ code: MailErrorCode.Tls })

        expect(mailErrorOf(own)).toBe(own)
    })
    it.each([
        ["MAIL_AUTH", MailErrorCode.Auth],
        ["MAIL_APP_PASSWORD", MailErrorCode.AppPassword],
        ["MAIL_CONNECT", MailErrorCode.Connect],
        ["MAIL_TIMEOUT", MailErrorCode.Timeout],
        ["MAIL_DNS", MailErrorCode.Dns],
        ["MAIL_TLS", MailErrorCode.Tls],
        ["MAIL_SENDER", MailErrorCode.Sender],
        ["MAIL_RECIPIENT", MailErrorCode.Recipient],
        ["MAIL_LIMIT", MailErrorCode.Limit],
        ["MAIL_UNKNOWN", MailErrorCode.Unknown],
        ["MAIL_ADDRESS_INVALID", MailErrorCode.AddressInvalid],
        ["MAIL_MESSAGE_INVALID", MailErrorCode.MessageInvalid],
    ] as const)("keeps the wire code %s and the server's words", (code, expected) => {
        const cause = new PackageMailError(code, { detail: "535 refused" })

        const mapped = mailErrorOf(cause)

        expect(mapped).toBeInstanceOf(MailError)
        expect(mapped).toMatchObject({ code: expected, params: { detail: "535 refused" }, cause })
    })
    it("answers anything else as unknown", () => {
        const cause = new Error("socket closed")

        expect(mailErrorOf(cause)).toMatchObject({ code: MailErrorCode.Unknown, cause })
    })
})

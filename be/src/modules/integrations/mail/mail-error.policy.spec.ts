import { Test } from "@nestjs/testing"
import { MailError as PackageMailError } from "@starci/mail"
import { MailError, MailErrorCode } from "./errors/mail.error"
import { mailErrorOf } from "./mail-error.policy"

const SUBJECT = Symbol("mail-error.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { mailErrorOf } }],
    }).compile()
    return moduleRef.get<{ mailErrorOf: typeof mailErrorOf }>(SUBJECT)
}

describe("mail-error policy / mailErrorOf", () => {
    it("lets the integration's own error through as it is", async () => {
        const subject = await build()

        const own = new MailError({ code: MailErrorCode.Tls })

        expect(subject.mailErrorOf(own)).toBe(own)
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
    ] as const)("keeps the wire code %s and the server's words", async (code, expected) => {
        const subject = await build()

        const cause = new PackageMailError(code, { detail: "535 refused" })

        const mapped = subject.mailErrorOf(cause)

        expect(mapped).toBeInstanceOf(MailError)
        expect(mapped).toMatchObject({ code: expected, params: { detail: "535 refused" }, cause })
    })
    it("answers anything else as unknown", async () => {
        const subject = await build()

        const cause = new Error("socket closed")

        expect(subject.mailErrorOf(cause)).toMatchObject({ code: MailErrorCode.Unknown, cause })
    })
})

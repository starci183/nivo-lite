import { Test } from "@nestjs/testing"
import { MailError, MailErrorCode } from "./errors/mail.error"
import { classifySmtpFailure as realClassifySmtpFailure } from "./smtp-error.policy"

const SUBJECT = Symbol("smtp-error.policy")

type Subject = Pick<typeof import("./smtp-error.policy"), "classifySmtpFailure">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { classifySmtpFailure: realClassifySmtpFailure } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const failure = (shape: Record<string, unknown>) =>
    Object.assign(new Error(typeof shape.message === "string" ? shape.message : ""), shape)

describe("classifySmtpFailure", () => {
    it.each([
        [failure({ code: "EAUTH", message: "Invalid login" }), MailErrorCode.Auth],
        [failure({ responseCode: 535, message: "bad" }), MailErrorCode.Auth],
        [failure({ responseCode: 534, message: "bad" }), MailErrorCode.Auth],
        [failure({ message: "Invalid credentials" }), MailErrorCode.Auth],
        [
            failure({ code: "EAUTH", response: "5.7.9 Application-specific password required" }),
            MailErrorCode.AppPassword,
        ],
        [failure({ code: "ETIMEDOUT", message: "x" }), MailErrorCode.Timeout],
        [failure({ code: "ECONNTIMEOUT", message: "x" }), MailErrorCode.Timeout],
        [failure({ message: "Greeting never received" }), MailErrorCode.Timeout],
        [failure({ code: "ENOTFOUND", message: "x" }), MailErrorCode.Dns],
        [failure({ code: "EDNS", message: "x" }), MailErrorCode.Dns],
        [failure({ message: "getaddrinfo failed" }), MailErrorCode.Dns],
        [failure({ code: "ECONNREFUSED", message: "x" }), MailErrorCode.Connect],
        [failure({ code: "ECONNECTION", message: "x" }), MailErrorCode.Connect],
        [failure({ code: "ECONNRESET", message: "x" }), MailErrorCode.Connect],
        [failure({ code: "EHOSTUNREACH", message: "x" }), MailErrorCode.Connect],
        [failure({ message: "self-signed certificate" }), MailErrorCode.Tls],
        [failure({ code: "ESOCKET", message: "x" }), MailErrorCode.Tls],
        [failure({ code: "EENVELOPE", message: "Can not send" }), MailErrorCode.Recipient],
        [
            failure({ code: "EENVELOPE", response: "550 5.7.60 Client not authenticated to send as this sender" }),
            MailErrorCode.Sender,
        ],
        [failure({ message: "550 user unknown, sender not allowed" }), MailErrorCode.Recipient],
        [failure({ message: "553 relay access denied" }), MailErrorCode.Sender],
        [failure({ message: "452 4.2.1 quota exceeded" }), MailErrorCode.Limit],
        [failure({ message: "something odd" }), MailErrorCode.Unknown],
        ["not an object", MailErrorCode.Unknown],
        [null, MailErrorCode.Unknown],
    ])("classifies %#", async (error, code) => {
        const subject = await build()

        expect(subject.classifySmtpFailure(error).code).toBe(code)
    })
    it("keeps the server's words, collapsed and bounded, and the cause", async () => {
        const subject = await build()

        const cause = failure({ code: "ETIMEDOUT", message: `line one\n   line two ${"x".repeat(400)}` })

        const mapped = subject.classifySmtpFailure(cause)

        expect(mapped.cause).toBe(cause)
        expect(String(mapped.params.detail)).toMatch(/^line one line two x+$/u)
        expect(String(mapped.params.detail).length).toBeLessThanOrEqual(300)
    })
    it("passes a MailError through unchanged", async () => {
        const subject = await build()

        const own = new MailError({ code: MailErrorCode.Limit })

        expect(subject.classifySmtpFailure(own)).toBe(own)
    })
    it("reads a response and a message that are not strings as empty", async () => {
        const subject = await build()

        expect(subject.classifySmtpFailure({ response: 5, message: 7, responseCode: "535" }).code).toBe(
            MailErrorCode.Unknown,
        )
    })
})

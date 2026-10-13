import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { MailErrorCode } from "./errors/mail.error"
import { MailClient } from "./mail.client"
import type { MailMessage, SmtpConfig } from "./mail.contracts"
import { MAIL_OPTIONS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"

const mockLookup = jest.fn()
const mockCreateTransport = jest.fn()

jest.mock("node:dns/promises", () => ({ lookup: (...args: ReadonlyArray<unknown>) => mockLookup(...args) }))
jest.mock("nodemailer", () => ({
    __esModule: true,
    default: { createTransport: (...args: ReadonlyArray<unknown>) => mockCreateTransport(...args) },
}))

const lookupMock = mockLookup
const createTransport = mockCreateTransport

const PUBLIC: MailOptions = { allowPrivateHosts: false, platform: null, helloName: "nivo.test" }
const DEV: MailOptions = { ...PUBLIC, allowPrivateHosts: true }
const WITH_PLATFORM: MailOptions = { ...PUBLIC, platform: { url: new Secret("smtp://platform"), from: "NIVO <no-reply@nivo.test>" } }

const config: SmtpConfig = {
    host: "smtp.example.com",
    port: 587,
    security: "starttls",
    user: "owner@example.com",
    pass: "secret",
    fromName: "Shop",
    fromEmail: "owner@example.com",
    replyTo: "help@example.com",
}
const message: MailMessage = { to: "a@b.vn", subject: "Hi", html: "<p>Hi</p>", text: "Hi" }

const build = async (options: MailOptions) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MailClient, { provide: MAIL_OPTIONS, useValue: options }],
    }).compile()
    return moduleRef.get(MailClient)
}

const transportAnswering = (answer: unknown) => {
    const sendMail = jest.fn((...args: ReadonlyArray<unknown>): unknown =>
        typeof answer === "function" ? Reflect.apply(answer, undefined, args) : Promise.resolve(answer),
    )
    const close = jest.fn()
    createTransport.mockReturnValue({ sendMail, close })
    return { sendMail, close }
}

beforeEach(() => {
    jest.resetAllMocks()
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
})

describe("MailClient", () => {
    describe("hasPlatformSender", () => {
        it("tells whether the deployment has a platform sender", async () => {
            expect((await build(PUBLIC)).hasPlatformSender()).toBe(false)
            expect((await build(WITH_PLATFORM)).hasPlatformSender()).toBe(true)
        })
    })

    describe("assertSmtpTarget", () => {
        it("accepts a public mail server on a mail port", async () => {
            const client = await build(PUBLIC)

            await expect(client.assertSmtpTarget("smtp.example.com", 587)).resolves.toBeUndefined()
        })

        it("accepts an address literal without a lookup", async () => {
            const client = await build(PUBLIC)

            await expect(client.assertSmtpTarget("8.8.8.8", 465)).resolves.toBeUndefined()
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it("refuses a malformed host and a port out of range, whatever the site", async () => {
            const client = await build(DEV)

            await expect(client.assertSmtpTarget("bad host", 587)).rejects.toMatchObject({ code: MailErrorCode.Dns })
            await expect(client.assertSmtpTarget("smtp.example.com", 70000)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })
        })

        it("lets a development site reach any port and private address", async () => {
            const client = await build(DEV)

            await expect(client.assertSmtpTarget("localhost", 1025)).resolves.toBeUndefined()
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it("refuses a port that is not a mail port on a public site", async () => {
            const client = await build(PUBLIC)

            await expect(client.assertSmtpTarget("smtp.example.com", 8080)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })
        })

        it("refuses a name that resolves to a private address, to nothing or not at all", async () => {
            const client = await build(PUBLIC)
            lookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }])
            await expect(client.assertSmtpTarget("intranet.example.com", 587)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })

            lookupMock.mockResolvedValueOnce([])
            await expect(client.assertSmtpTarget("empty.example.com", 587)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })

            lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"))
            await expect(client.assertSmtpTarget("nowhere.example.com", 587)).rejects.toMatchObject({
                code: MailErrorCode.Dns,
            })
        })
    })

    describe("sendThroughSmtp", () => {
        it("sends through the account with strict TLS on a public site and answers the message id", async () => {
            const { sendMail, close } = transportAnswering({ messageId: "<id-1>", rejected: [] })
            const client = await build(PUBLIC)

            await expect(client.sendThroughSmtp(config, message)).resolves.toEqual({ messageId: "<id-1>" })

            expect(createTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: "smtp.example.com",
                    port: 587,
                    secure: false,
                    requireTLS: true,
                    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
                    auth: { user: "owner@example.com", pass: "secret" },
                    name: "nivo.test",
                }),
            )
            expect(sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: { name: "Shop", address: "owner@example.com" },
                    replyTo: "help@example.com",
                    to: "a@b.vn",
                }),
            )
            expect(close).toHaveBeenCalledTimes(1)
        })

        it("relaxes TLS on a development site, uses implicit TLS on request and omits empty credentials and reply-to", async () => {
            transportAnswering({ messageId: "<id-2>", rejected: [] })
            const client = await build(DEV)

            await client.sendThroughSmtp(
                { ...config, security: "tls", user: "", pass: "", replyTo: "" },
                { ...message, attachments: [{ filename: "a.txt", content: Buffer.from("x") }] },
            )

            expect(createTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    secure: true,
                    requireTLS: false,
                    tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
                    auth: undefined,
                }),
            )
        })

        it("sends no reply-to when the account has none", async () => {
            const { sendMail } = transportAnswering({ messageId: "<id-3>", rejected: [] })
            const client = await build(DEV)

            await client.sendThroughSmtp({ ...config, replyTo: undefined }, message)

            expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: undefined }))
        })

        it("refuses a rejected recipient and still closes the transport", async () => {
            const { close } = transportAnswering({ messageId: "<id-4>", rejected: ["a@b.vn"] })
            const client = await build(PUBLIC)

            await expect(client.sendThroughSmtp(config, message)).rejects.toMatchObject({
                code: MailErrorCode.Recipient,
                params: { detail: "a@b.vn" },
            })
            expect(close).toHaveBeenCalledTimes(1)
        })

        it("classifies a server failure", async () => {
            transportAnswering(jest.fn().mockRejectedValue(Object.assign(new Error("denied"), { code: "EAUTH" })))
            const client = await build(PUBLIC)

            await expect(client.sendThroughSmtp(config, message)).rejects.toMatchObject({ code: MailErrorCode.Auth })
        })

        it("does not open a transport to a refused target", async () => {
            const client = await build(PUBLIC)

            await expect(client.sendThroughSmtp({ ...config, port: 8080 }, message)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })
            expect(createTransport).not.toHaveBeenCalled()
        })
    })

    describe("sendThroughPlatform", () => {
        it("sends an owner notice from the platform address", async () => {
            const { sendMail, close } = transportAnswering({ messageId: "<id-5>" })
            const client = await build(WITH_PLATFORM)

            await expect(
                client.sendThroughPlatform({ ...message, attachments: [{ filename: "a.txt", content: Buffer.from("x") }] }),
            ).resolves.toEqual({ messageId: "<id-5>" })

            expect(createTransport).toHaveBeenCalledWith("smtp://platform")
            expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "NIVO <no-reply@nivo.test>" }))
            expect(close).toHaveBeenCalledTimes(1)
        })

        it("classifies a platform failure and refuses when no platform sender is configured", async () => {
            transportAnswering(jest.fn().mockRejectedValue(Object.assign(new Error("slow"), { code: "ETIMEDOUT" })))

            await expect((await build(WITH_PLATFORM)).sendThroughPlatform(message)).rejects.toMatchObject({
                code: MailErrorCode.Timeout,
            })
            await expect((await build(PUBLIC)).sendThroughPlatform(message)).rejects.toMatchObject({
                code: MailErrorCode.NotConfigured,
            })
        })
    })
})

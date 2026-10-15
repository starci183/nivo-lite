import dns from "node:dns/promises"
import type { LookupAddress, LookupAllOptions } from "node:dns"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"
import { Secret } from "@modules/platform/config"
import { MailErrorCode } from "./errors/mail.error"
import { MailClient } from "./mail.client"
import type { EmailLayoutInput, MailMessage, SmtpConfig } from "./mail.contracts"
import { MAIL_OPTIONS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"

interface LookupOwner {
    lookup: (hostname: string, options: LookupAllOptions) => Promise<Array<LookupAddress>>
}

const lookupOwner: LookupOwner = dns
const lookupMock = jest.spyOn(lookupOwner, "lookup")
const createTransport = jest.spyOn(nodemailer, "createTransport")

const PUBLIC: MailOptions = { allowPrivateHosts: false, platform: null, helloName: "nivo.test" }
const DEV: MailOptions = { ...PUBLIC, allowPrivateHosts: true }
const WITH_PLATFORM: MailOptions = {
    ...PUBLIC,
    platform: { url: new Secret("smtp://platform"), from: "NIVO <no-reply@nivo.test>" },
}

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

const transportAnswering = (answer: Partial<SMTPTransport.SentMessageInfo> | Error) => {
    // nodemailer 10 types `sendMail` as overloads whose last one is the callback form, so the promise answer is a plain function mixed in.
    const sendMail = jest.fn(() =>
        answer instanceof Error
            ? Promise.reject(answer)
            : Promise.resolve({
                  envelope: { from: "owner@example.com", to: ["a@b.vn"] },
                  accepted: [],
                  rejected: [],
                  pending: [],
                  response: "250 accepted",
                  messageId: "<default>",
                  ...answer,
              }),
    )
    const transport = Object.assign(mock<Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>>(), {
        sendMail,
    })
    createTransport.mockReturnValue(transport)
    return transport
}

beforeEach(() => {
    jest.resetAllMocks()
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
})

afterAll(() => {
    jest.restoreAllMocks()
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
            transportAnswering(Object.assign(new Error("denied"), { code: "EAUTH" }))
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
                client.sendThroughPlatform({
                    ...message,
                    attachments: [{ filename: "a.txt", content: Buffer.from("x") }],
                }),
            ).resolves.toEqual({ messageId: "<id-5>" })

            expect(createTransport).toHaveBeenCalledWith("smtp://platform")
            expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "NIVO <no-reply@nivo.test>" }))
            expect(close).toHaveBeenCalledTimes(1)
        })

        it("classifies a platform failure and refuses when no platform sender is configured", async () => {
            transportAnswering(Object.assign(new Error("slow"), { code: "ETIMEDOUT" }))

            await expect((await build(WITH_PLATFORM)).sendThroughPlatform(message)).rejects.toMatchObject({
                code: MailErrorCode.Timeout,
            })
            await expect((await build(PUBLIC)).sendThroughPlatform(message)).rejects.toMatchObject({
                code: MailErrorCode.NotConfigured,
            })
        })
    })

    describe("sendNoticeThroughPlatform", () => {
        const notice: EmailLayoutInput = {
            shopName: "Tea Shop",
            title: "  Connection\r\nneeds\nattention  ",
            body: "Please reconnect.",
            footer: "NIVO",
            lang: "en",
        }

        it("renders the notice layout and sends it through the platform with a one-line title", async () => {
            const { sendMail, close } = transportAnswering({ messageId: "<notice-1>" })
            const client = await build(WITH_PLATFORM)

            await expect(client.sendNoticeThroughPlatform("owner@example.com", notice)).resolves.toEqual({
                messageId: "<notice-1>",
            })

            expect(createTransport.mock.calls).toEqual([["smtp://platform"]])
            expect(sendMail.mock.calls).toEqual([
                [
                    {
                        from: "NIVO <no-reply@nivo.test>",
                        to: "owner@example.com",
                        subject: "Connection needs attention",
                        html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Connection needs attention</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<tr><td style="background:#e11d48;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">Tea Shop</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.55"><p style="margin:0 0 16px">Please reconnect.</p></td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;color:#71717a;font-size:12px;line-height:1.5">NIVO</td></tr>
</table></td></tr></table></body></html>`,
                        text: "Tea Shop\n\nPlease reconnect.\n\n--\nNIVO\n",
                        attachments: undefined,
                    },
                ],
            ])
            expect(close.mock.calls).toEqual([[]])
        })

        it("rejects when the platform sender is not configured", async () => {
            const client = await build(PUBLIC)

            await expect(client.sendNoticeThroughPlatform("owner@example.com", notice)).rejects.toMatchObject({
                code: MailErrorCode.NotConfigured,
            })
            expect(createTransport.mock.calls).toEqual([])
        })
    })
})

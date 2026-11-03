import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { MAILER, MailError as PackageMailError } from "@starci/mail"
import type { Mailer, MailOptions as MailerOptions } from "@starci/mail"
import { MailErrorCode } from "./errors/mail.error"
import type { MailDelivery, SmtpConfig } from "./mail.contracts"
import { MAILER_FACTORY, MAIL_SETTINGS } from "./mail.decorators"
import type { ClosableMailer } from "./mail.decorators"
import type { MailOptions } from "./mail.options"
import { MailRelayService } from "./mail-relay.service"

const PUBLIC: MailOptions = {
    host: "smtp.platform.test",
    port: 587,
    from: { name: "Nivo", address: "no-reply@nivo.test" },
    helloName: "nivo.test",
    webOrigin: "https://app.nivo.test",
    brandName: "Nivo",
    defaultLanguage: "en",
    confirmTtlSeconds: 86_400,
    resetTtlSeconds: 3_600,
    allowPrivateHosts: false,
}

const DEV: MailOptions = { ...PUBLIC, allowPrivateHosts: true }

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

const delivery: MailDelivery = { to: "a@b.vn", message: { subject: "Hi", html: "<p>Hi</p>", text: "Hi" } }

const sentOf = { messageId: "<m1>", accepted: ["a@b.vn"] }

const build = async (settings: MailOptions, answer: Error | null = null) => {
    const account = mock<ClosableMailer>({
        send: jest.fn(() => (answer === null ? Promise.resolve(sentOf) : Promise.reject(answer))),
        onModuleDestroy: jest.fn(),
    })
    const platform = mock<Mailer>({
        send: jest.fn(() => (answer === null ? Promise.resolve(sentOf) : Promise.reject(answer))),
    })
    const factory = jest.fn((_options: MailerOptions) => account)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MailRelayService,
            { provide: MAIL_SETTINGS, useValue: builder<MailOptions>(settings)() },
            { provide: MAILER_FACTORY, useValue: factory },
            { provide: MAILER, useValue: platform },
        ],
    }).compile()
    return { relay: moduleRef.get(MailRelayService), account, platform, factory }
}

describe("MailRelayService / assertSmtpTarget", () => {
    it("accepts a public mail server on a mail port", async () => {
        const { relay } = await build(PUBLIC)

        await expect(relay.assertSmtpTarget("8.8.8.8", 465)).resolves.toBeUndefined()
    })
    it("refuses a malformed host and a port out of range, whatever the site", async () => {
        const { relay } = await build(DEV)

        await expect(relay.assertSmtpTarget("bad host!", 587)).rejects.toMatchObject({ code: MailErrorCode.Dns })
        await expect(relay.assertSmtpTarget("smtp.example.com", 70_000)).rejects.toMatchObject({
            code: MailErrorCode.Connect,
        })
    })
    it("refuses a port that is not a mail port and an address inside the network", async () => {
        const { relay } = await build(PUBLIC)

        await expect(relay.assertSmtpTarget("8.8.8.8", 3306)).rejects.toMatchObject({ code: MailErrorCode.Connect })
        await expect(relay.assertSmtpTarget("10.0.0.5", 587)).rejects.toMatchObject({ code: MailErrorCode.Connect })
    })
    it("lets a development site point at a private address and any port", async () => {
        const { relay } = await build(DEV)

        await expect(relay.assertSmtpTarget("127.0.0.1", 1025)).resolves.toBeUndefined()
    })
})

describe("MailRelayService / sendThroughSmtp", () => {
    it("sends through the account with its login, sender and reply-to, then closes the connection", async () => {
        const { relay, account, factory } = await build(PUBLIC)

        await expect(relay.sendThroughSmtp(config, delivery)).resolves.toEqual(sentOf)

        expect(factory).toHaveBeenCalledWith({
            host: "smtp.example.com",
            port: 587,
            security: "starttls",
            auth: { user: "owner@example.com", pass: "secret" },
            from: { name: "Shop", address: "owner@example.com" },
            replyTo: "help@example.com",
            helloName: "nivo.test",
            allowSelfSigned: false,
            publicTargetOnly: true,
        })
        expect(account.send).toHaveBeenCalledWith(delivery)
        expect(account.onModuleDestroy).toHaveBeenCalledTimes(1)
    })
    it("keeps implicit TLS and leaves out an empty login, an empty reply-to and a missing hello name", async () => {
        const { relay, factory } = await build({ ...PUBLIC, helloName: undefined })

        await relay.sendThroughSmtp({ ...config, security: "tls", user: "", pass: "", replyTo: "" }, delivery)

        expect(factory).toHaveBeenCalledWith({
            host: "smtp.example.com",
            port: 587,
            security: "tls",
            from: { name: "Shop", address: "owner@example.com" },
            allowSelfSigned: false,
            publicTargetOnly: true,
        })
    })
    it("reaches a development catcher with no login and no encryption, and any target", async () => {
        const { relay, factory } = await build(DEV)

        await relay.sendThroughSmtp({ ...config, user: "", pass: "", replyTo: undefined }, delivery)

        expect(factory).toHaveBeenCalledWith(
            expect.objectContaining({ security: "none", allowSelfSigned: true, publicTargetOnly: false }),
        )
    })
    it("still asks a development account that logs in for STARTTLS", async () => {
        const { relay, factory } = await build(DEV)

        await relay.sendThroughSmtp(config, delivery)

        expect(factory).toHaveBeenCalledWith(expect.objectContaining({ security: "starttls", allowSelfSigned: true }))
    })
    it("answers a failure as the integration error and closes the connection all the same", async () => {
        const failure = new PackageMailError("MAIL_AUTH", { detail: "535 bad login" })
        const { relay, account } = await build(PUBLIC, failure)

        await expect(relay.sendThroughSmtp(config, delivery)).rejects.toMatchObject({ code: MailErrorCode.Auth })
        expect(account.onModuleDestroy).toHaveBeenCalledTimes(1)
    })
})

describe("MailRelayService / sendThroughPlatform", () => {
    it("sends through the platform sender", async () => {
        const { relay, platform } = await build(PUBLIC)

        await expect(relay.sendThroughPlatform(delivery)).resolves.toEqual(sentOf)
        expect(platform.send).toHaveBeenCalledWith(delivery)
    })
    it("answers a failure as the integration error", async () => {
        const { relay } = await build(PUBLIC, new Error("socket closed"))

        await expect(relay.sendThroughPlatform(delivery)).rejects.toMatchObject({ code: MailErrorCode.Unknown })
    })
})

import { EnvSource, Secret } from "@modules/platform/config"
import { parseMailConfig } from "./mail.config"

const BASE = {
    MAIL_HOST: "smtp.platform.test",
    MAIL_FROM: "no-reply@nivo.test",
    MAIL_FROM_NAME: "Nivo",
    AUTH_WEB_ORIGIN: "https://app.nivo.test/some/path",
}

const read = (extra: Readonly<Record<string, string>> = {}) => parseMailConfig(new EnvSource({ ...BASE, ...extra }))

describe("mail config / parseMailConfig", () => {
    it("reads the server, the sender and the app settings with the defaults of a sign-in mail", () => {
        expect(read()).toEqual({
            host: "smtp.platform.test",
            port: 587,
            security: "starttls",
            from: { name: "Nivo", address: "no-reply@nivo.test" },
            helloName: "nivo.vn",
            webOrigin: "https://app.nivo.test",
            brandName: "Nivo",
            defaultLanguage: "en",
            confirmTtlSeconds: 86_400,
            resetTtlSeconds: 3_600,
            allowPrivateHosts: true,
        })
    })
    it("reads every tunable and the login, whose password stays a secret", () => {
        const options = read({
            MAIL_PORT: "465",
            MAIL_SECURITY: "tls",
            MAIL_USER: "mailer",
            MAIL_PASSWORD: "p4ss-fixture",
            MAIL_HELLO_NAME: "mx.nivo.test",
            MAIL_DEFAULT_LANGUAGE: "vi",
            MAIL_CONFIRM_TTL_SECONDS: "7200",
            MAIL_RESET_TTL_SECONDS: "600",
        })

        expect(options).toMatchObject({
            port: 465,
            security: "tls",
            helloName: "mx.nivo.test",
            defaultLanguage: "vi",
            confirmTtlSeconds: 7200,
            resetTtlSeconds: 600,
        })
        expect(options.auth?.user).toBe("mailer")
        expect(options.auth?.pass).toBeInstanceOf(Secret)
    })
    it("refuses a mail server or a sender that is missing and a value outside its choices", () => {
        expect(() => parseMailConfig(new EnvSource({}))).toThrow()
        expect(() => read({ MAIL_SECURITY: "ssl" })).toThrow()
        expect(() => read({ MAIL_DEFAULT_LANGUAGE: "fr" })).toThrow()
        expect(() => read({ MAIL_USER: "mailer" })).toThrow()
    })
    it("lets a workspace point its own SMTP account at a private address only off a public site or by the flag", () => {
        expect(read({ SITE_URL: "https://nivo.vn" }).allowPrivateHosts).toBe(false)
        expect(read({ SITE_URL: "http://nivo.vn" }).allowPrivateHosts).toBe(true)
        expect(read({ SITE_URL: "https://localhost" }).allowPrivateHosts).toBe(true)
        expect(read({ SITE_URL: "https://app.localhost" }).allowPrivateHosts).toBe(true)
        expect(read({ SITE_URL: "not a url" }).allowPrivateHosts).toBe(true)
        expect(read({ SITE_URL: "https://nivo.vn", SMTP_ALLOW_PRIVATE_HOSTS: "true" }).allowPrivateHosts).toBe(true)
    })
})

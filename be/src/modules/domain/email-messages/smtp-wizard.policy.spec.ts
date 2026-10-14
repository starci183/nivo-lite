import { builder } from "@starci/jest-preset"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import type { SmtpFormInput } from "./smtp-wizard.contracts"
import { cleanSmtpForm, cleanSmtpPassword, isSmtpPreset, passwordOfParsed } from "./smtp-wizard.policy"

const formOf = builder<SmtpFormInput>({
    preset: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    security: "tls",
    user: "shop@gmail.com",
    password: "abcd efgh ijkl mnop",
    fromName: "Flower Shop",
    fromEmail: "shop@gmail.com",
    replyTo: "",
})

describe("SMTP wizard policy", () => {
    describe("isSmtpPreset", () => {
        it.each(["google_workspace", "gmail", "microsoft365", "zoho", "vn_hosting", "relay_service"])(
            "accepts the offered %s preset",
            (preset) => {
                expect(isSmtpPreset(preset)).toBe(true)
            },
        )

        it("rejects unoffered and differently cased presets", () => {
            expect(isSmtpPreset("other")).toBe(false)
            expect(isSmtpPreset("Gmail")).toBe(false)
        })
    })

    describe("cleanSmtpPassword", () => {
        it.each(["gmail", "google_workspace"])("removes every whitespace from %s app passwords", (preset) => {
            expect(cleanSmtpPassword(preset, " abcd efgh\tijkl\nmnop\r\n ")).toBe("abcdefghijklmnop")
        })

        it("trims other provider passwords while preserving their internal whitespace", () => {
            expect(cleanSmtpPassword("microsoft365", "  internal pass\tword  ")).toBe("internal pass\tword")
        })
    })

    describe("cleanSmtpForm", () => {
        it("normalizes addresses and host, removes sender header characters and cleans the app password", () => {
            expect(
                cleanSmtpForm(
                    formOf({
                        host: " SMTP.GMAIL.COM ",
                        user: " Shop@Gmail.com ",
                        fromName: '  "Flower\r\n<Shop>"  ',
                        fromEmail: " Shop@Gmail.COM ",
                        replyTo: " Support@Example.COM ",
                    }),
                ),
            ).toEqual({
                ok: true,
                form: {
                    preset: "gmail",
                    host: "smtp.gmail.com",
                    port: 465,
                    security: "tls",
                    user: "Shop@Gmail.com",
                    password: "abcdefghijklmnop",
                    fromName: "FlowerShop",
                    fromEmail: "shop@gmail.com",
                    replyTo: "support@example.com",
                },
            })
        })

        it("bounds text fields and uses STARTTLS for other security values", () => {
            const address = `${"a".repeat(248)}@ex.co`

            expect(
                cleanSmtpForm(
                    formOf({
                        preset: "zoho",
                        host: "H".repeat(254),
                        port: 65535,
                        security: "other",
                        user: "u".repeat(255),
                        password: "  internal password  ",
                        fromName: "n".repeat(81),
                        fromEmail: `${address}z`,
                        replyTo: `${address}z`,
                    }),
                ),
            ).toEqual({
                ok: true,
                form: {
                    preset: "zoho",
                    host: "h".repeat(253),
                    port: 65535,
                    security: "starttls",
                    user: "u".repeat(254),
                    password: "internal password",
                    fromName: "n".repeat(80),
                    fromEmail: address,
                    replyTo: address,
                },
            })
        })

        it("accepts the minimum port and an empty reply address", () => {
            expect(cleanSmtpForm(formOf({ port: 1 }))).toEqual({
                ok: true,
                form: {
                    preset: "gmail",
                    host: "smtp.gmail.com",
                    port: 1,
                    security: "tls",
                    user: "shop@gmail.com",
                    password: "abcdefghijklmnop",
                    fromName: "Flower Shop",
                    fromEmail: "shop@gmail.com",
                    replyTo: "",
                },
            })
        })

        it("rejects an unsupported preset before checking the remaining fields", () => {
            expect(cleanSmtpForm(formOf({ preset: "other", host: "", port: 0 }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpInvalid,
            })
        })

        it("rejects an empty host before checking the port", () => {
            expect(cleanSmtpForm(formOf({ host: " \t ", port: 0 }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpHost,
            })
        })

        it.each([1.5, 0, 65536])("rejects invalid SMTP port %s", (port) => {
            expect(cleanSmtpForm(formOf({ port }))).toEqual({ ok: false, code: EmailMessagesErrorCode.SmtpPort })
        })

        it.each<Partial<SmtpFormInput>>([{ fromName: ' "<>\r\n ' }, { user: " \t " }, { fromEmail: " " }])(
            "rejects missing required sender fields %o",
            (patch) => {
                expect(cleanSmtpForm(formOf(patch))).toEqual({ ok: false, code: EmailMessagesErrorCode.SmtpFields })
            },
        )

        it.each<Partial<SmtpFormInput>>([{ fromEmail: "bad-address" }, { replyTo: "bad-address" }])(
            "rejects malformed mailbox fields %o",
            (patch) => {
                expect(cleanSmtpForm(formOf(patch))).toEqual({ ok: false, code: EmailMessagesErrorCode.SmtpEmail })
            },
        )

        it("allows a blank password for the Google Workspace relay", () => {
            expect(
                cleanSmtpForm(formOf({ preset: "google_workspace", host: "smtp-relay.gmail.com", password: " \t " })),
            ).toEqual({
                ok: true,
                form: {
                    preset: "google_workspace",
                    host: "smtp-relay.gmail.com",
                    port: 465,
                    security: "tls",
                    user: "shop@gmail.com",
                    password: "",
                    fromName: "Flower Shop",
                    fromEmail: "shop@gmail.com",
                    replyTo: "",
                },
            })
        })

        it.each<Partial<SmtpFormInput>>([
            { preset: "google_workspace", host: "smtp.gmail.com" },
            { preset: "gmail", host: "smtp-relay.gmail.com" },
        ])("requires a password outside the Workspace relay %o", (patch) => {
            expect(cleanSmtpForm(formOf({ ...patch, password: " \t " }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpFields,
            })
        })
    })

    describe("passwordOfParsed", () => {
        it("returns stored string passwords, including an empty string", () => {
            expect(passwordOfParsed({ password: "secret", other: true })).toBe("secret")
            expect(passwordOfParsed({ password: "" })).toBe("")
        })

        it.each([null, undefined, "secret", 42, true, {}, { password: 42 }, { password: null }])(
            "answers null for a credential without a string password: %p",
            (parsed) => {
                expect(passwordOfParsed(parsed)).toBeNull()
            },
        )
    })
})

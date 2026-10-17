import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import type { SmtpFormInput } from "./smtp-wizard.contracts"
import { cleanSmtpForm, cleanSmtpPassword, isSmtpPreset, passwordOfParsed } from "./smtp-wizard.policy"

const SUBJECT = Symbol("smtp-wizard.policy")
type Subject = {
    isSmtpPreset: typeof isSmtpPreset
    cleanSmtpPassword: typeof cleanSmtpPassword
    cleanSmtpForm: typeof cleanSmtpForm
    passwordOfParsed: typeof passwordOfParsed
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { isSmtpPreset, cleanSmtpPassword, cleanSmtpForm, passwordOfParsed } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
            async (preset) => {
                const subject = await build()

                expect(subject.isSmtpPreset(preset)).toBe(true)
            },
        )

        it("rejects unoffered and differently cased presets", async () => {
            const subject = await build()

            expect(subject.isSmtpPreset("other")).toBe(false)
            expect(subject.isSmtpPreset("Gmail")).toBe(false)
        })
    })

    describe("cleanSmtpPassword", () => {
        it.each(["gmail", "google_workspace"])("removes every whitespace from %s app passwords", async (preset) => {
            const subject = await build()

            expect(subject.cleanSmtpPassword(preset, " abcd efgh\tijkl\nmnop\r\n ")).toBe("abcdefghijklmnop")
        })

        it("trims other provider passwords while preserving their internal whitespace", async () => {
            const subject = await build()

            expect(subject.cleanSmtpPassword("microsoft365", "  internal pass\tword  ")).toBe("internal pass\tword")
        })
    })
})

describe("SMTP wizard policy", () => {
    describe("cleanSmtpForm", () => {
        it("normalizes addresses and host, removes sender header characters and cleans the app password", async () => {
            const subject = await build()

            expect(
                subject.cleanSmtpForm(
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

        it("bounds text fields and uses STARTTLS for other security values", async () => {
            const subject = await build()

            const address = `${"a".repeat(248)}@ex.co`

            expect(
                subject.cleanSmtpForm(
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
    })
})

describe("SMTP wizard policy", () => {
    describe("cleanSmtpForm", () => {
        it("accepts the minimum port and an empty reply address", async () => {
            const subject = await build()

            expect(subject.cleanSmtpForm(formOf({ port: 1 }))).toEqual({
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

        it("rejects an unsupported preset before checking the remaining fields", async () => {
            const subject = await build()

            expect(subject.cleanSmtpForm(formOf({ preset: "other", host: "", port: 0 }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpInvalid,
            })
        })

        it("rejects an empty host before checking the port", async () => {
            const subject = await build()

            expect(subject.cleanSmtpForm(formOf({ host: " \t ", port: 0 }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpHost,
            })
        })

        it.each([1.5, 0, 65536])("rejects invalid SMTP port %s", async (port) => {
            const subject = await build()

            expect(subject.cleanSmtpForm(formOf({ port }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpPort,
            })
        })

        it.each<Partial<SmtpFormInput>>([{ fromName: ' "<>\r\n ' }, { user: " \t " }, { fromEmail: " " }])(
            "rejects missing required sender fields %o",
            async (patch) => {
                const subject = await build()

                expect(subject.cleanSmtpForm(formOf(patch))).toEqual({
                    ok: false,
                    code: EmailMessagesErrorCode.SmtpFields,
                })
            },
        )

        it.each<Partial<SmtpFormInput>>([{ fromEmail: "bad-address" }, { replyTo: "bad-address" }])(
            "rejects malformed mailbox fields %o",
            async (patch) => {
                const subject = await build()

                expect(subject.cleanSmtpForm(formOf(patch))).toEqual({
                    ok: false,
                    code: EmailMessagesErrorCode.SmtpEmail,
                })
            },
        )
    })
})

describe("SMTP wizard policy", () => {
    describe("cleanSmtpForm", () => {
        it("allows a blank password for the Google Workspace relay", async () => {
            const subject = await build()

            expect(
                subject.cleanSmtpForm(
                    formOf({ preset: "google_workspace", host: "smtp-relay.gmail.com", password: " \t " }),
                ),
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
        ])("requires a password outside the Workspace relay %o", async (patch) => {
            const subject = await build()

            expect(subject.cleanSmtpForm(formOf({ ...patch, password: " \t " }))).toEqual({
                ok: false,
                code: EmailMessagesErrorCode.SmtpFields,
            })
        })
    })

    describe("passwordOfParsed", () => {
        it("returns stored string passwords, including an empty string", async () => {
            const subject = await build()

            expect(subject.passwordOfParsed({ password: "secret", other: true })).toBe("secret")
            expect(subject.passwordOfParsed({ password: "" })).toBe("")
        })

        it.each([null, undefined, "secret", 42, true, {}, { password: 42 }, { password: null }])(
            "answers null for a credential without a string password: %p",
            async (parsed) => {
                const subject = await build()

                expect(subject.passwordOfParsed(parsed)).toBeNull()
            },
        )
    })
})

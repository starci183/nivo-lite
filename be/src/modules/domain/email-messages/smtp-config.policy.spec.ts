import { builder } from "@starci/jest-preset"
import type { ConnectionRecord } from "@modules/domain/connections"
import { chooseSmtp, smtpConfigOf } from "./smtp-config.policy"

const connectionOf = builder<ConnectionRecord>({
    id: "smtp-1",
    workspaceId: "workspace-1",
    provider: "smtp",
    name: "Shop mail",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-13T00:00:00.000Z",
})

describe("SMTP config policy", () => {
    describe("smtpConfigOf", () => {
        it("combines public connection facts with the supplied secret", () => {
            expect(
                smtpConfigOf(
                    {
                        host: "smtp.example.com",
                        port: "465",
                        security: "tls",
                        user: "shop@example.com",
                        from_name: "Flower Shop",
                        from_email: "shop@example.com",
                        reply_to: "support@example.com",
                    },
                    "smtp-secret",
                ),
            ).toEqual({
                host: "smtp.example.com",
                port: 465,
                security: "tls",
                user: "shop@example.com",
                pass: "smtp-secret",
                fromName: "Flower Shop",
                fromEmail: "shop@example.com",
                replyTo: "support@example.com",
            })
        })

        it("defaults absent public facts to STARTTLS on port 587 and empty fields", () => {
            expect(smtpConfigOf({}, "secret")).toEqual({
                host: "",
                port: 587,
                security: "starttls",
                user: "",
                pass: "secret",
                fromName: "",
                fromEmail: "",
                replyTo: undefined,
            })
        })

        it("omits an explicitly empty reply address and uses STARTTLS for other security values", () => {
            expect(smtpConfigOf({ reply_to: "", security: "other", port: "2525" }, "secret")).toEqual({
                host: "",
                port: 2525,
                security: "starttls",
                user: "",
                pass: "secret",
                fromName: "",
                fromEmail: "",
                replyTo: undefined,
            })
        })
    })

    describe("chooseSmtp", () => {
        it("uses the connected workspace default before an older connected sender", () => {
            const oldest = connectionOf()
            const disconnectedDefault = connectionOf({ id: "smtp-pending", status: "pending", isDefault: true })
            const defaultSender = connectionOf({ id: "smtp-default", isDefault: true })

            expect(chooseSmtp([disconnectedDefault, oldest, defaultSender], undefined)).toBe(defaultSender)
        })

        it("uses the first connected sender when none is the default", () => {
            const pending = connectionOf({ id: "smtp-pending", status: "pending" })
            const oldest = connectionOf({ id: "smtp-oldest" })
            const newer = connectionOf({ id: "smtp-newer" })

            expect(chooseSmtp([pending, oldest, newer], undefined)).toBe(oldest)
        })

        it("uses an explicitly requested connected sender even when another sender is the default", () => {
            const defaultSender = connectionOf({ id: "smtp-default", isDefault: true })
            const requested = connectionOf({ id: "smtp-requested" })

            expect(chooseSmtp([defaultSender, requested], "smtp-requested")).toBe(requested)
        })

        it("answers null when the requested sender is absent or not connected", () => {
            const connected = connectionOf()
            const pending = connectionOf({ id: "smtp-pending", status: "pending" })

            expect(chooseSmtp([connected, pending], "smtp-missing")).toBeNull()
            expect(chooseSmtp([connected, pending], "smtp-pending")).toBeNull()
            expect(chooseSmtp([], undefined)).toBeNull()
        })
    })
})

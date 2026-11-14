import { readFileSync } from "node:fs"
import { MailError } from "@modules/integrations/mail"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import type { SmtpOutgoing } from "./smtp-send.contracts"
import { SMTP_SANDBOX_CATALOGUE_CASES } from "./smtp-sandbox.catalogue"
import { SmtpSandboxSendService } from "./smtp-sandbox-send.service"

const ACCOUNT = sandboxAccount({ id: "smtp-sbx", workspaceId: "ws-1", provider: "smtp" })
const CONNECTION = connectionRecord({ id: "smtp-sbx", workspaceId: "ws-1", provider: "smtp", sandbox: true })
const MAIL: SmtpOutgoing = {
    to: "buyer@example.com",
    message: {
        subject: "Your order",
        text: "Thank you",
        html: "<p>Thank you</p>",
        attachments: [{ filename: "invoice.pdf", content: new Uint8Array([1, 2, 3]) }],
    },
}

const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    return { sandbox, store, service: new SmtpSandboxSendService(sandbox) }
}

describe("SmtpSandboxSendService", () => {
    it("SMTP-1: accepts by default with a running message id and the accepted recipient", async () => {
        const { service } = setup()

        await expect(service.send(CONNECTION, undefined, MAIL)).resolves.toEqual({ messageId: "sbx-smtp-000001", accepted: ["buyer@example.com"] })
        await expect(service.send(CONNECTION, undefined, MAIL)).resolves.toMatchObject({ messageId: "sbx-smtp-000002" })
    })

    it("SMTP-2: the recipient is refused with the live MAIL_RECIPIENT error", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "send", "SMTP-2")

        const failure: unknown = await service.send(CONNECTION, undefined, MAIL).catch((cause: unknown) => cause)

        expect(failure).toBeInstanceOf(MailError)
        expect(failure).toMatchObject({ code: "MAIL_RECIPIENT" })
    })

    it("SMTP-3: the login is refused with the live MAIL_AUTH error", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "send", "SMTP-3")

        await expect(service.send(CONNECTION, undefined, MAIL)).rejects.toMatchObject({ code: "MAIL_AUTH" })
    })

    it("SMTP-4: no answer in time is the live MAIL_TIMEOUT error; the next case is sticky until the default is picked again", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "send", "SMTP-4")

        await expect(service.send(CONNECTION, undefined, MAIL)).rejects.toMatchObject({ code: "MAIL_TIMEOUT" })
        await expect(service.send(CONNECTION, undefined, MAIL)).rejects.toMatchObject({ code: "MAIL_TIMEOUT" })
        await sandbox.setNextCase(ACCOUNT, "send", "SMTP-1")
        await expect(service.send(CONNECTION, undefined, MAIL)).resolves.toMatchObject({ messageId: "sbx-smtp-000003" })
    })

    it("logs one call per send holding the whole mail (to, subject, text, html, attachment names), also a refused one", async () => {
        const { sandbox, service } = setup()
        await service.send(CONNECTION, undefined, MAIL)
        await sandbox.setNextCase(ACCOUNT, "send", "SMTP-2")
        await service.send(CONNECTION, undefined, MAIL).catch(() => undefined)

        const calls = await sandbox.calls(ACCOUNT, "send")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({
            key: "buyer@example.com",
            request: { to: "buyer@example.com", subject: "Your order", text: "Thank you", html: "<p>Thank you</p>", attachments: ["invoice.pdf"] },
            result: { outcome: "answered" },
        })
        expect(calls[1]).toMatchObject({ result: { outcome: "threw", error: "MAIL_RECIPIENT" } })
    })

    it("is deterministic: the same send answers the same on a fresh account", async () => {
        const first = await setup().service.send(CONNECTION, undefined, MAIL)

        await expect(setup().service.send(CONNECTION, undefined, MAIL)).resolves.toEqual(first)
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new SmtpSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.send({ ...CONNECTION, sandbox: false }, undefined, MAIL)).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.send(CONNECTION, undefined, MAIL)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has unique SMTP-<n> ids, exactly one default case, all for the send operation", () => {
        const ids = SMTP_SANDBOX_CATALOGUE_CASES.map((one) => one.id)

        expect(ids).toEqual(["SMTP-1", "SMTP-2", "SMTP-3", "SMTP-4"])
        expect(SMTP_SANDBOX_CATALOGUE_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["SMTP-1"])
        expect(SMTP_SANDBOX_CATALOGUE_CASES.every((one) => one.operation === "send")).toBe(true)
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(SmtpSandboxSendService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

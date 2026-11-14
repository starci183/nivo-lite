import { readFileSync } from "node:fs"
import { ChannelsErrorCode } from "@modules/domain/channels"
import type { CustomerSendRequest } from "@modules/domain/channels"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { TELEGRAM_SEND_SANDBOX_CASES, TELEGRAM_STAFF_SANDBOX_CASES } from "./telegram-sandbox-send.catalogue"
import { TelegramSandboxSendService } from "./telegram-sandbox-send.service"

const ACCOUNT = sandboxAccount({ id: "conn-t", workspaceId: "ws-1", provider: "telegram" })
const CONNECTION = connectionRecord({ id: "conn-t", workspaceId: "ws-1", provider: "telegram", sandbox: true })
const TARGET = { id: "route-1", workspaceId: "ws-1", channel: "telegram", externalId: "700100200", connectionId: "conn-t" }
const NOW = new Date("2026-11-14T10:00:00.000Z")
const CHAT = "700100200"

const requestOf = (patch: Partial<CustomerSendRequest> = {}): CustomerSendRequest => ({
    workspaceId: "ws-1",
    conversationId: "route-1",
    messageId: "m-1",
    text: "Hello",
    at: NOW,
    ...patch,
})

const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    return { sandbox, store, service: new TelegramSandboxSendService(sandbox) }
}

const staffOf = () => ({ workspaceId: "ws-1", connectionId: "conn-t", provider: "telegram", recipientId: "staff-1", text: "Shift starts" }) as const

describe("TelegramSandboxSendService", () => {
    it("TELEGRAM-SEND-1: delivers by default as the live bot route answers", async () => {
        const { service } = setup()

        expect(service.provider).toBe("telegram")
        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toEqual({ delivered: true, failure: null, outcome: "acknowledged" })
    })

    it("TELEGRAM-SEND-2 and 3 (sticky): the picked next case answers the live receipt of that case, and picking 1 goes back to delivered", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "send", "TELEGRAM-SEND-2")
        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
        await sandbox.setNextCase(ACCOUNT, "send", "TELEGRAM-SEND-3")
        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toEqual({ delivered: false, failure: null, outcome: "ambiguous" })
        await sandbox.setNextCase(ACCOUNT, "send", "TELEGRAM-SEND-1")
        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toMatchObject({ delivered: true })
    })

    it("has no reply window: a send is delivered however long ago the person wrote", async () => {
        const { sandbox, service } = setup()
        await sandbox.call(ACCOUNT, "inbound", {}, { answer: (state) => state.write("last-line", CHAT, NOW.getTime() - 400 * 24 * 3_600_000) })

        await expect(service.send(CONNECTION, TARGET, CHAT, requestOf())).resolves.toMatchObject({ delivered: true })
    })

    it("refuses a person with no chat id as the live route does", async () => {
        const { service } = setup()

        await expect(service.send(CONNECTION, TARGET, null, requestOf())).resolves.toEqual({ delivered: false, failure: null, outcome: "rejected" })
    })

    it("logs exactly one call per send, with the person, the text and the pictures", async () => {
        const { sandbox, service } = setup()
        const images = [{ url: "an-image-link", caption: "A" }]

        await service.send(CONNECTION, TARGET, CHAT, requestOf({ images }))
        await service.send(CONNECTION, TARGET, CHAT, requestOf())

        const calls = await sandbox.calls(ACCOUNT, "send")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: CHAT, request: { userId: CHAT, text: "Hello", images }, result: { outcome: "answered" } })
    })

    it("is deterministic: the same send answers the same on a fresh account", async () => {
        const first = await setup().service.send(CONNECTION, TARGET, CHAT, requestOf())
        const second = await setup().service.send(CONNECTION, TARGET, CHAT, requestOf())

        expect(second).toEqual(first)
    })

    it("TELEGRAM-STAFF-1: sends a staff text by default and logs one sendToPerson call with the recipient and the words", async () => {
        const { sandbox, service } = setup()

        await expect(service.sendToPerson(CONNECTION, staffOf())).resolves.toBeUndefined()

        const calls = await sandbox.calls(ACCOUNT, "sendToPerson")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "staff-1", request: { recipientId: "staff-1", text: "Shift starts" }, result: { outcome: "answered" } })
    })

    it("TELEGRAM-STAFF-2: throws what the live route throws when the bot is gone (sticky), and goes back to accepting when STAFF-1 is picked", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "sendToPerson", "TELEGRAM-STAFF-2")
        await expect(service.sendToPerson(CONNECTION, staffOf())).rejects.toMatchObject({ code: ChannelsErrorCode.ConnectionNotFound })
        await expect(service.sendToPerson(CONNECTION, staffOf())).rejects.toMatchObject({ code: ChannelsErrorCode.ConnectionNotFound })
        expect((await sandbox.calls(ACCOUNT, "sendToPerson")).map((one) => one.result)).toEqual([
            { outcome: "threw", error: ChannelsErrorCode.ConnectionNotFound },
            { outcome: "threw", error: ChannelsErrorCode.ConnectionNotFound },
        ])
        await sandbox.setNextCase(ACCOUNT, "sendToPerson", "TELEGRAM-STAFF-1")
        await expect(service.sendToPerson(CONNECTION, staffOf())).resolves.toBeUndefined()
    })

    it("shows typing: one logged showTyping call per show, nothing sent anywhere", async () => {
        const { sandbox, service } = setup()

        await expect(service.showTyping(CONNECTION, CHAT)).resolves.toBeUndefined()
        await service.showTyping(CONNECTION, CHAT)

        const calls = await sandbox.calls(ACCOUNT, "showTyping")
        expect(calls.map((one) => [one.key, one.result.outcome])).toEqual([
            [CHAT, "answered"],
            [CHAT, "answered"],
        ])
    })

    it("refuses a live account and a switched-off sandbox on every member", async () => {
        const { service } = setup()
        const off = new TelegramSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)
        const live = { ...CONNECTION, sandbox: false }

        await expect(service.send(live, TARGET, CHAT, requestOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(service.sendToPerson(live, staffOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(service.showTyping(live, CHAT)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.send(CONNECTION, TARGET, CHAT, requestOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(off.sendToPerson(CONNECTION, staffOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(off.showTyping(CONNECTION, CHAT)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has unique TELEGRAM-SEND-<n> ids with exactly one default and TELEGRAM-STAFF-<n> likewise, each for its operation", () => {
        expect(TELEGRAM_SEND_SANDBOX_CASES.map((one) => one.id)).toEqual(["TELEGRAM-SEND-1", "TELEGRAM-SEND-2", "TELEGRAM-SEND-3"])
        expect(TELEGRAM_SEND_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["TELEGRAM-SEND-1"])
        expect(TELEGRAM_SEND_SANDBOX_CASES.every((one) => one.operation === "send")).toBe(true)
        expect(TELEGRAM_STAFF_SANDBOX_CASES.map((one) => one.id)).toEqual(["TELEGRAM-STAFF-1", "TELEGRAM-STAFF-2"])
        expect(TELEGRAM_STAFF_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["TELEGRAM-STAFF-1"])
        expect(TELEGRAM_STAFF_SANDBOX_CASES.every((one) => one.operation === "sendToPerson")).toBe(true)
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(TelegramSandboxSendService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

import { readFileSync } from "node:fs"
import type { CustomerSendRequest } from "@modules/domain/channels"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { META_REPLY_WINDOW_MS, META_SANDBOX_CATALOGUE } from "./meta-sandbox.catalogue"
import { META_SEND_SANDBOX_CASES } from "./meta-sandbox-send.catalogue"
import { MetaSandboxSendService } from "./meta-sandbox-send.service"

const ACCOUNT = sandboxAccount({ id: "conn-m", workspaceId: "ws-1", provider: "meta" })
const CONNECTION = connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider: "meta", sandbox: true })
const TARGET = { id: "route-1", workspaceId: "ws-1", channel: "facebook", externalId: "7700110022", connectionId: "conn-m" }
const NOW = new Date("2026-11-14T10:00:00.000Z")
const PERSON = "7700110022"
const DELIVERED = { delivered: true, failure: null, outcome: "acknowledged" }
const NO = { delivered: false, failure: null, outcome: "ambiguous" }

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
    return { sandbox, store, service: new MetaSandboxSendService(sandbox) }
}

/** Keeps the moment the person last wrote, as the inbound cases do. */
const wroteAt = (sandbox: ReturnType<typeof setup>["sandbox"], atMs: number) =>
    sandbox.call(ACCOUNT, "inbound", {}, { answer: (state) => state.write("last-line", PERSON, atMs) })

describe("MetaSandboxSendService", () => {
    it("META-SEND-1: delivers by default as the live Page sender's yes, for a person who never wrote", async () => {
        const { service } = setup()

        expect(service.provider).toBe("meta")
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(DELIVERED)
    })

    it("delivers inside the 24-hour window and refuses outside it, whatever the picked case", async () => {
        const { sandbox, service } = setup()
        await wroteAt(sandbox, NOW.getTime() - META_REPLY_WINDOW_MS + 1)
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(DELIVERED)

        await wroteAt(sandbox, NOW.getTime() - META_REPLY_WINDOW_MS - 1)
        await sandbox.setNextCase(ACCOUNT, "send", "META-SEND-1")
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(NO)
    })

    it("judges the window against the moment of the request, not a clock", async () => {
        const { sandbox, service } = setup()
        await wroteAt(sandbox, NOW.getTime())

        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf({ at: new Date(NOW.getTime() + META_REPLY_WINDOW_MS + 1) }))).resolves.toEqual(NO)
    })

    it("META-SEND-2 and 3 (sticky): the picked next case answers the live Page sender's no, and picking 1 goes back to delivered", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "send", "META-SEND-2")
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(NO)
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(NO)
        await sandbox.setNextCase(ACCOUNT, "send", "META-SEND-3")
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(NO)
        await sandbox.setNextCase(ACCOUNT, "send", "META-SEND-1")
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(DELIVERED)
    })

    it("answers a person with no id as the live sender does: its no", async () => {
        const { service } = setup()

        await expect(service.send(CONNECTION, TARGET, null, requestOf())).resolves.toEqual(NO)
    })

    it("logs exactly one call per send, with the person, the text and the pictures", async () => {
        const { sandbox, service } = setup()
        const images = [{ url: "an-image-link", caption: "A" }]

        await service.send(CONNECTION, TARGET, PERSON, requestOf({ images }))
        await service.send(CONNECTION, TARGET, PERSON, requestOf())

        const calls = await sandbox.calls(ACCOUNT, "send")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: PERSON, request: { userId: PERSON, text: "Hello", images }, result: { outcome: "answered" } })
    })

    it("is deterministic: the same send answers the same on a fresh account", async () => {
        const first = await setup().service.send(CONNECTION, TARGET, PERSON, requestOf())
        const second = await setup().service.send(CONNECTION, TARGET, PERSON, requestOf())

        expect(second).toEqual(first)
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new MetaSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.send({ ...CONNECTION, sandbox: false }, TARGET, PERSON, requestOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.send(CONNECTION, TARGET, PERSON, requestOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has unique META-SEND-<n> ids, exactly one default case, all for the send operation", () => {
        expect(META_SEND_SANDBOX_CASES.map((one) => one.id)).toEqual(["META-SEND-1", "META-SEND-2", "META-SEND-3"])
        expect(META_SEND_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["META-SEND-1"])
        expect(META_SEND_SANDBOX_CASES.every((one) => one.operation === "send")).toBe(true)
    })

    it("R62 end to end in the sandbox: after META-1 the send is delivered; after META-3 (a line 25 h old) it is refused outside the window", async () => {
        const { sandbox, service } = setup()
        const inboundOf = (id: string) => {
            const found = META_SANDBOX_CATALOGUE.cases.find((one) => one.id === id)?.inbound
            if (found === undefined) throw new Error(id)
            return found
        }

        await sandbox.inbound(ACCOUNT, "META-1", inboundOf("META-1"), { psid: PERSON, text: "Chao shop" }, NOW)
        await expect(service.send(CONNECTION, TARGET, PERSON, requestOf())).resolves.toEqual(DELIVERED)

        await sandbox.inbound(ACCOUNT, "META-3", inboundOf("META-3"), { psid: "7700110044", text: "Shop oi" }, NOW)
        await expect(service.send(CONNECTION, TARGET, "7700110044", requestOf())).resolves.toEqual(NO)
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(MetaSandboxSendService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

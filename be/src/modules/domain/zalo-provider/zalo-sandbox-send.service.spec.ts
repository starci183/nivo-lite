import { readFileSync } from "node:fs"
import { ChannelsErrorCode, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import type { CustomerSendRequest } from "@modules/domain/channels"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ZALO_SANDBOX_CATALOGUE, ZALO_SANDBOX_LAST_LINE_STATE as ZALO_LAST_LINE_STATE } from "./zalo-sandbox.catalogue"
import { ZALO_SEND_SANDBOX_CASES, ZALO_STAFF_SANDBOX_CASES } from "./zalo-sandbox-send.catalogue"
import { ZaloSandboxSendService } from "./zalo-sandbox-send.service"

const ACCOUNT = sandboxAccount({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa" })
const CONNECTION = connectionRecord({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })
const TARGET = { id: "route-1", workspaceId: "ws-1", channel: "zalo", externalId: "8800110022", connectionId: "conn-z" }
const NOW = new Date("2026-11-14T10:00:00.000Z")
const USER = "8800110022"

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
    return { sandbox, store, service: new ZaloSandboxSendService(sandbox) }
}

/** Keeps the moment the person last wrote, as the inbound cases do. */
const wroteAt = (sandbox: ReturnType<typeof setup>["sandbox"], atMs: number) =>
    sandbox.call(ACCOUNT, "inbound", {}, { answer: (state) => state.write(ZALO_LAST_LINE_STATE, USER, atMs) })

describe("ZaloSandboxSendService", () => {
    it("ZALO-SEND-1: delivers by default as the live consultation route answers, for a person who never wrote", async () => {
        const { service } = setup()

        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toEqual({
            delivered: true,
            failure: null,
            outcome: "acknowledged",
            via: "consultation",
        })
    })

    it("delivers inside the window and refuses outside it with the live window receipt, whatever the picked case", async () => {
        const { sandbox, service } = setup()
        await wroteAt(sandbox, NOW.getTime() - ZALO_FREE_WINDOW_MS + 1)
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toMatchObject({ delivered: true })

        await wroteAt(sandbox, NOW.getTime() - ZALO_FREE_WINDOW_MS - 1)
        await sandbox.setNextCase(ACCOUNT, "send", "ZALO-SEND-1")
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_window_expired",
            outcome: "rejected",
        })
    })

    it("judges the window against the moment of the request, not a clock", async () => {
        const { sandbox, service } = setup()
        await wroteAt(sandbox, NOW.getTime())

        await expect(
            service.send(CONNECTION, TARGET, USER, requestOf({ at: new Date(NOW.getTime() + ZALO_FREE_WINDOW_MS + 1) })),
        ).resolves.toMatchObject({ failure: "zalo_window_expired" })
    })

    it("says zns_not_configured on a window refusal that carried a renewal notice, as a live OA without a template", async () => {
        const { sandbox, service } = setup()
        await wroteAt(sandbox, NOW.getTime() - 3 * ZALO_FREE_WINDOW_MS)
        const notification = {
            kind: "renewal",
            phone: null,
            fields: { customerName: "An", plan: "Pro", endDate: "2026-12-01", amount: 1, transferContent: "X", invoiceNumber: "INV-1" },
        } as const

        await expect(service.send(CONNECTION, TARGET, USER, requestOf({ notification }))).resolves.toEqual({
            delivered: false,
            failure: "zalo_window_expired",
            outcome: "rejected",
            note: "zns_not_configured",
        })
    })

    it("ZALO-SEND-2, 3 and 4: the picked next case answers the live receipt of that case", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "send", "ZALO-SEND-2")
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_window_expired",
            outcome: "rejected",
        })
        await sandbox.setNextCase(ACCOUNT, "send", "ZALO-SEND-3")
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_token",
            outcome: "rejected",
        })
        await sandbox.setNextCase(ACCOUNT, "send", "ZALO-SEND-4")
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_error",
            outcome: "ambiguous",
        })
        await sandbox.setNextCase(ACCOUNT, "send", "ZALO-SEND-1")
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toMatchObject({ delivered: true })
    })

    it("answers not connected for a person without a Zalo id, as the live route does", async () => {
        const { service } = setup()

        await expect(service.send(CONNECTION, TARGET, null, requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_not_connected",
            outcome: "rejected",
        })
    })

    it("logs exactly one call per send, with the person, the text and the pictures", async () => {
        const { sandbox, service } = setup()
        const images = [{ url: "an-image-link", caption: "A" }]

        await service.send(CONNECTION, TARGET, USER, requestOf({ images }))
        await service.send(CONNECTION, TARGET, USER, requestOf())

        const calls = await sandbox.calls(ACCOUNT, "send")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: USER, request: { userId: USER, text: "Hello", images }, result: { outcome: "answered" } })
    })

    it("is deterministic: the same send answers the same on a fresh account", async () => {
        const first = await setup().service.send(CONNECTION, TARGET, USER, requestOf())
        const second = await setup().service.send(CONNECTION, TARGET, USER, requestOf())

        expect(second).toEqual(first)
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new ZaloSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.send({ ...CONNECTION, sandbox: false }, TARGET, USER, requestOf())).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.send(CONNECTION, TARGET, USER, requestOf())).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has unique ZALO-SEND-<n> ids, exactly one default case, all for the send operation", () => {
        const ids = ZALO_SEND_SANDBOX_CASES.map((one) => one.id)

        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toEqual(["ZALO-SEND-1", "ZALO-SEND-2", "ZALO-SEND-3", "ZALO-SEND-4"])
        expect(ZALO_SEND_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["ZALO-SEND-1"])
        expect(ZALO_SEND_SANDBOX_CASES.every((one) => one.operation === "send")).toBe(true)
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(ZaloSandboxSendService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })

    it("R62 end to end in the sandbox: after ZALO-1 the send is delivered; after ZALO-3 (a line 49 h old) it is refused outside the window", async () => {
        const { sandbox, service } = setup()
        const inboundOf = (id: string) => {
            const found = ZALO_SANDBOX_CATALOGUE.cases.find((one) => one.id === id)?.inbound
            if (found === undefined) throw new Error(id)
            return found
        }

        await sandbox.inbound(ACCOUNT, "ZALO-1", inboundOf("ZALO-1"), { userId: USER, text: "Chao shop" }, NOW)
        await expect(service.send(CONNECTION, TARGET, USER, requestOf())).resolves.toMatchObject({ delivered: true })

        await sandbox.inbound(ACCOUNT, "ZALO-3", inboundOf("ZALO-3"), { userId: "8800110044", text: "Shop oi" }, NOW)
        await expect(service.send(CONNECTION, TARGET, "8800110044", requestOf())).resolves.toEqual({
            delivered: false,
            failure: "zalo_window_expired",
            outcome: "rejected",
        })
    })

    it("answers the customer's name from the profile cases ZALO-4 / ZALO-5, one logged profileOf call per read, and nothing for a stranger", async () => {
        const { sandbox, service } = setup()

        await expect(service.nameOf(CONNECTION, USER)).resolves.toBe("Nguyen Van An")
        await expect(service.nameOf(CONNECTION, "9999")).resolves.toBe("")
        await sandbox.setNextCase(ACCOUNT, "profileOf", "ZALO-5")
        await expect(service.nameOf(CONNECTION, USER)).resolves.toBe("")

        const calls = await sandbox.calls(ACCOUNT, "profileOf")
        expect(calls.map((one) => one.key)).toEqual([USER, "9999", USER])
        expect(calls[0]).toMatchObject({ result: { outcome: "answered" } })
    })

    it("ZALO-STAFF-1: sends a staff text by default and logs one sendToPerson call with the recipient and the words", async () => {
        const { sandbox, service } = setup()
        const message = { workspaceId: "ws-1", connectionId: "conn-z", provider: "zalo_oa", recipientId: "staff-1", text: "Shift starts" } as const

        await expect(service.sendToPerson(CONNECTION, message)).resolves.toBeUndefined()

        const calls = await sandbox.calls(ACCOUNT, "sendToPerson")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "staff-1", request: { recipientId: "staff-1", text: "Shift starts" }, result: { outcome: "answered" } })
    })

    it("ZALO-STAFF-2: throws what the live route throws without a token (sticky), and goes back to accepting when ZALO-STAFF-1 is picked", async () => {
        const { sandbox, service } = setup()
        const message = { workspaceId: "ws-1", connectionId: "conn-z", provider: "zalo_oa", recipientId: "staff-1", text: "Hi" } as const

        await sandbox.setNextCase(ACCOUNT, "sendToPerson", "ZALO-STAFF-2")
        await expect(service.sendToPerson(CONNECTION, message)).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloNotAuthorized })
        await expect(service.sendToPerson(CONNECTION, message)).rejects.toMatchObject({ code: ChannelsErrorCode.ZaloNotAuthorized })
        expect((await sandbox.calls(ACCOUNT, "sendToPerson")).map((one) => one.result)).toEqual([
            { outcome: "threw", error: ChannelsErrorCode.ZaloNotAuthorized },
            { outcome: "threw", error: ChannelsErrorCode.ZaloNotAuthorized },
        ])
        await sandbox.setNextCase(ACCOUNT, "sendToPerson", "ZALO-STAFF-1")
        await expect(service.sendToPerson(CONNECTION, message)).resolves.toBeUndefined()
    })

    it("refuses the staff text and the name read of a live account and of a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new ZaloSandboxSendService(sandboxServiceOff(ACCOUNT).sandbox)
        const message = { workspaceId: "ws-1", connectionId: "conn-z", provider: "zalo_oa", recipientId: "staff-1", text: "Hi" } as const

        await expect(service.sendToPerson({ ...CONNECTION, sandbox: false }, message)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(service.nameOf({ ...CONNECTION, sandbox: false }, USER)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.sendToPerson(CONNECTION, message)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(off.nameOf(CONNECTION, USER)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has the staff cases ZALO-STAFF-<n> with exactly one default, all for the sendToPerson operation", () => {
        expect(ZALO_STAFF_SANDBOX_CASES.map((one) => one.id)).toEqual(["ZALO-STAFF-1", "ZALO-STAFF-2"])
        expect(ZALO_STAFF_SANDBOX_CASES.filter((one) => one.default === true).map((one) => one.id)).toEqual(["ZALO-STAFF-1"])
        expect(ZALO_STAFF_SANDBOX_CASES.every((one) => one.operation === "sendToPerson")).toBe(true)
    })
})

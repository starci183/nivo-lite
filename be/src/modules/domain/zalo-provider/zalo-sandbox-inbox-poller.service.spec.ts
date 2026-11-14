import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode, type SandboxInput } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ZALO_SANDBOX_CATALOGUE } from "./zalo-sandbox.catalogue"
import { ZaloSandboxInboxPollerService } from "./zalo-sandbox-inbox-poller.service"

const ACCOUNT = sandboxAccount({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa" })
const CONNECTION = connectionRecord({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })
const ALL = { from: new Date("2026-11-01T00:00:00.000Z"), to: undefined, limit: 100 }
const AT = new Date("2026-11-14T02:00:00.000Z")

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new ZaloSandboxInboxPollerService(sandbox) }
}

/** Sends one inbound case of the catalogue through the real frame, so the account keeps its message. */
const sendCase = async (sandbox: ReturnType<typeof setup>["sandbox"], id: string, input: SandboxInput, at: Date = AT) => {
    const inbound = ZALO_SANDBOX_CATALOGUE.cases.find((one) => one.id === id)?.inbound
    if (inbound === undefined) throw new Error(`no inbound case ${id}`)
    await sandbox.inbound(ACCOUNT, id, inbound, input, at)
}

describe("ZaloSandboxInboxPollerService", () => {
    it("answers an account whose cases were never sent an empty page", async () => {
        const { service } = setup()

        expect(await service.fetch(CONNECTION, ALL)).toMatchObject({ kind: "page", fetched: 0, items: [], oldestAt: undefined })
    })

    it("answers the messages the account's cases made, newest first, counts the picture as fetched but not as an item, marks the old text stale", async () => {
        const { sandbox, service } = setup()
        await sendCase(sandbox, "ZALO-1", { userId: "8800110022", text: "Chao shop" })
        await sendCase(sandbox, "ZALO-2", { userId: "8800110033" }, new Date("2026-11-14T02:30:00.000Z"))
        await sendCase(sandbox, "ZALO-3", { userId: "8800110044", text: "Don hom kia?" }, new Date("2026-11-14T03:00:00.000Z"))

        const page = await service.fetch(CONNECTION, ALL)

        expect(page).toMatchObject({ kind: "page", fetched: 3 })
        if (page.kind !== "page") throw new Error("page expected")
        expect(page.items.map((item) => [item.messageId, item.userId, item.userName, item.text, item.stale])).toEqual([
            ["sbx-zmsg-000001", "8800110022", "Nguyen Van An", "Chao shop", false],
            ["sbx-zmsg-000003", "8800110044", "Le Minh Chi", "Don hom kia?", true],
        ])
        expect(page.oldestAt?.toISOString()).toBe("2026-11-12T02:00:00.000Z")
        expect(page.newestAt?.toISOString()).toBe("2026-11-14T02:30:00.000Z")
    })

    it("honours its window and its limit", async () => {
        const { sandbox, service } = setup()
        await sendCase(sandbox, "ZALO-1", { userId: "8800110022", text: "one" })
        await sendCase(sandbox, "ZALO-1", { userId: "8800110022", text: "two" }, new Date("2026-11-14T04:00:00.000Z"))

        const early = await service.fetch(CONNECTION, { ...ALL, from: new Date("2026-11-14T00:00:00.000Z"), to: new Date("2026-11-14T03:00:00.000Z") })
        const limited = await service.fetch(CONNECTION, { ...ALL, limit: 1 })
        const empty = await service.fetch(CONNECTION, { ...ALL, from: new Date("2027-01-01T00:00:00.000Z") })

        expect(early).toMatchObject({ kind: "page", fetched: 1 })
        expect(limited).toMatchObject({ kind: "page", fetched: 1 })
        expect(limited.kind === "page" ? limited.items[0]?.text : "").toBe("two")
        expect(empty).toMatchObject({ kind: "page", fetched: 0, items: [], oldestAt: undefined })
    })

    it("logs exactly one call per request, deterministically", async () => {
        const { sandbox, service } = setup()
        await sendCase(sandbox, "ZALO-1", { userId: "8800110022", text: "hi" })

        expect(await service.fetch(CONNECTION, ALL)).toEqual(await service.fetch(CONNECTION, ALL))
        expect(await sandbox.calls(ACCOUNT, "fetch")).toHaveLength(2)
    })

    it("is the zalo_oa poller with the live limits and classifies any failure fatal", () => {
        const { service } = setup()

        expect(service.provider).toBe("zalo_oa")
        expect(service.limits).toEqual({ ratePerSecond: 2, burst: 4, concurrency: 2 })
        expect(service.classify()).toEqual({ kind: "fatal" })
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new ZaloSandboxInboxPollerService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.fetch({ ...CONNECTION, sandbox: false }, ALL)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.fetch(CONNECTION, ALL)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(ZaloSandboxInboxPollerService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { seedSepayMovements } from "@tests/fixtures/builders/sepay-sandbox.builder"
import { SepaySandboxFeedPollerService } from "./sepay-sandbox-feed-poller.service"

const ACCOUNT = sandboxAccount({ id: "conn-s", workspaceId: "ws-1", provider: "sepay" })
const CONNECTION = connectionRecord({ id: "conn-s", workspaceId: "ws-1", provider: "sepay", sandbox: true })
const ALL = { from: new Date("2026-11-14T00:00:00.000Z"), to: undefined, limit: 100 }

/** The service over an account whose inbound cases made five movements (the seed), the empty one when `empty`. */
const setup = async (empty = false) => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    if (!empty) await seedSepayMovements(sandbox, ACCOUNT)
    return { sandbox, service: new SepaySandboxFeedPollerService(sandbox) }
}

describe("SepaySandboxFeedPollerService", () => {
    it("answers nothing for an account no case was sent to", async () => {
        const { service } = await setup(true)

        expect(await service.fetch(CONNECTION, ALL)).toMatchObject({ kind: "page", fetched: 0, items: [] })
    })

    it("answers every movement the account's cases made as the credit the webhook delivers (same delivery key and event id), newest first", async () => {
        const { service } = await setup()

        const page = await service.fetch(CONNECTION, ALL)

        expect(page).toMatchObject({ kind: "page", fetched: 5 })
        if (page.kind !== "page") throw new Error("page expected")
        expect(page.items.map((item) => item.deliveryId)).toEqual([
            "conn-s:sepay:9100005",
            "conn-s:sepay:9100004",
            "conn-s:sepay:9100003",
            "conn-s:sepay:9100002",
            "conn-s:sepay:9100001",
        ])
        expect(page.items[0]?.credit).toMatchObject({
            amount: 450000,
            eventId: "sepay:9100005",
            account: "0011004455667",
            occurredAt: "2026-11-14T04:12:51.000Z",
        })
        expect(page.items[1]?.credit).toMatchObject({ amount: 80000, direction: "debit" })
        expect(page.items[3]?.credit).toMatchObject({ amount: 499000, content: "NIVO DH1002" })
        expect(page.oldestAt?.toISOString()).toBe("2026-11-14T02:15:02.000Z")
        expect(page.newestAt?.toISOString()).toBe("2026-11-14T04:12:51.000Z")
    })

    it("honours its window and its limit", async () => {
        const { service } = await setup()

        const narrow = await service.fetch(CONNECTION, {
            from: new Date("2026-11-14T02:30:00.000Z"),
            to: new Date("2026-11-14T03:10:00.000Z"),
            limit: 100,
        })
        const limited = await service.fetch(CONNECTION, { ...ALL, limit: 2 })
        const empty = await service.fetch(CONNECTION, { ...ALL, from: new Date("2027-01-01T00:00:00.000Z") })

        expect(narrow).toMatchObject({ kind: "page", fetched: 2 })
        expect(limited).toMatchObject({ kind: "page", fetched: 2 })
        expect(empty).toMatchObject({ kind: "page", fetched: 0, items: [], oldestAt: undefined, newestAt: undefined })
    })

    it("logs exactly one call per request, deterministically", async () => {
        const { sandbox, service } = await setup()

        const first = await service.fetch(CONNECTION, ALL)
        const second = await service.fetch(CONNECTION, ALL)

        expect(second).toEqual(first)
        expect(await sandbox.calls(ACCOUNT, "fetch")).toHaveLength(2)
    })

    it("is the sepay poller with the live limits and classifies any failure fatal", async () => {
        const { service } = await setup()

        expect(service.provider).toBe("sepay")
        expect(service.inboxProvider).toBe("sepay-feed")
        expect(service.limits).toEqual({ ratePerSecond: 2, burst: 2, concurrency: 1 })
        expect(service.classify()).toEqual({ kind: "fatal" })
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = await setup()
        const off = new SepaySandboxFeedPollerService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.fetch({ ...CONNECTION, sandbox: false }, ALL)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.fetch(CONNECTION, ALL)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(SepaySandboxFeedPollerService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})

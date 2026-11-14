import {
    BINH_NAME,
    persistSalesDoorScene,
    saveRecord,
    salesDoorScene,
} from "../../fixtures/builders/sales-actions-scene.builder"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { versionOf } from "../../world/entity-engine-records.service"
import { API_APP_MODULES } from "../../world/api-app.options"
import { doorCallsOf, idsOfPage, useSeedConnection, type DoorPayload } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)
const scene = salesDoorScene(() => world.id())
const door = doorCallsOf(world, scene.workspaceId)
const [AN, BINH, CHAU] = scene.leads
const [SMALL, CONFIRMED, BIG] = scene.orders
const OWNER = scene.ownerUserId
const STAFF = scene.staffUserId

beforeAll(async () => {
    await persistSalesDoorScene(seed.manager, scene, (work) => world.cleanup(work))
})

const sorted = (ids: ReadonlyArray<string>): ReadonlyArray<string> => ids.toSorted((a, b) => a.localeCompare(b))

const idsOf = async (name: string, payload: DoorPayload = {}): Promise<ReadonlyArray<string>> =>
    idsOfPage(await door.read(OWNER, name, payload))

const stageOf = async (id: string): Promise<unknown> => (await door.read(OWNER, "blocks-core.sales.lead", { id }))["stage"]

const statusOf = async (id: string): Promise<unknown> => (await door.read(OWNER, "blocks-core.sales.order", { id }))["status"]

describe("the Sales workbench through the door, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })
})

describe("the customer lists", () => {
    it("lists the customers of the workspace only, and never another workspace's", async () => {
        const answer = await door.read(OWNER, "blocks-core.sales.api.lead.list")
        expect(sorted(idsOfPage(answer))).toEqual(sorted(scene.leads))
        expect(idsOfPage(answer)).not.toContain(scene.otherLeadId)
        expect(answer["cursor"]).toBeNull()
    })

    it("narrows by stage, sorts by name and searches without accents or case", async () => {
        expect(await idsOf("blocks-core.sales.api.lead.list", { stage: "new" })).toEqual([AN])
        expect(await idsOf("blocks-core.sales.api.lead.list", { sort: "name" })).toEqual([CHAU, AN, BINH])
        expect(await idsOf("blocks-core.sales.api.lead.list", { q: "tran thi binh" })).toEqual([BINH])
        expect(await idsOf("blocks-core.sales.api.lead.list", { q: "gift" })).toEqual([CHAU])
    })

    it("counts the customers of each stage under the same search", async () => {
        expect(await door.read(OWNER, "blocks-core.sales.api.lead.counts")).toMatchObject({
            counts: { new: 1, qualified: 1, proposal: 1 },
            total: 3,
        })
        expect(await door.read(OWNER, "blocks-core.sales.api.lead.counts", { q: "gift" })).toMatchObject({ total: 1 })
    })

    it("gives one customer with what the orders add up to, and nothing for another workspace's", async () => {
        expect(await door.read(OWNER, "blocks-core.sales.lead", { id: BINH })).toMatchObject({
            contactName: BINH_NAME,
            orderCount: 1,
            confirmedVnd: 300_000,
            latestOrderNo: "DH-20261104-0002",
            latestOrderStatus: "confirmed",
        })
        expect(await door.data(OWNER, "blocks-core.sales.lead", { id: scene.otherLeadId })).toBeNull()
    })
})

describe("the order lists", () => {
    it("lists the orders by amount, narrowed by status and searched by items, and counts each status", async () => {
        expect(await idsOf("blocks-core.sales.api.order.list", { sort: "amount" })).toEqual([BIG, CONFIRMED, SMALL])
        expect(sorted(await idsOf("blocks-core.sales.api.order.list", { status: "draft" }))).toEqual(sorted([SMALL, BIG]))
        expect(await idsOf("blocks-core.sales.api.order.list", { q: "gift" })).toEqual([BIG])
        expect(await door.read(OWNER, "blocks-core.sales.api.order.counts")).toMatchObject({
            counts: { draft: 2, confirmed: 1 },
            total: 3,
        })
    })

    it("gives one order with its customer's name and who confirms it", async () => {
        expect(await door.read(OWNER, "blocks-core.sales.order", { id: BIG })).toMatchObject({
            orderNo: "DH-20261104-0003",
            customer: "Le Minh Chau",
            approval: "owner",
            thresholdVnd: 5_000_000,
        })
        expect(await door.read(OWNER, "blocks-core.sales.order", { id: SMALL })).toMatchObject({ approval: "shop" })
    })

    it("lists the order that waits for the owner with its customer joined and a link", async () => {
        const waiting = await door.read(OWNER, "blocks-core.sales.api.order.waiting")
        expect(waiting["count"]).toBe("1")
        expect(idsOfPage(waiting)).toEqual([BIG])
        expect(JSON.stringify(waiting)).toContain("Le Minh Chau")
        expect(JSON.stringify(waiting)).toContain(`?tab=orders&order=${BIG}`)
    })
})

describe("the stage action", () => {
    it("moves a deal between open stages, and refuses as data to close it without a reason", async () => {
        expect(await door.act(OWNER, "sales.move-stage", { id: AN, to: "qualified" })).toEqual({
            ok: true,
            data: { stage: "qualified" },
        })
        expect(await stageOf(AN)).toBe("qualified")
        expect(await door.act(OWNER, "sales.move-stage", { id: AN, to: "lost" })).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_reason_required" },
        })
        expect(await stageOf(AN)).toBe("qualified")
        expect(await door.act(OWNER, "sales.move-stage", { id: AN, to: "new" })).toMatchObject({ ok: true })
    })

    it("refuses a customer that is not in the workspace, and a staff seat the workspace granted nothing", async () => {
        expect(await door.act(OWNER, "sales.move-stage", { id: scene.otherLeadId, to: "qualified" })).toMatchObject({
            ok: false,
            message: { key: "refusal_missing" },
        })
        expect(await door.act(STAFF, "sales.move-stage", { id: AN, to: "qualified" })).toMatchObject({
            ok: false,
            reason: "forbidden",
        })
        await expect(door.read(STAFF, "blocks-core.sales.api.lead.list")).rejects.toMatchObject({
            code: "WORKBENCH_DOOR_PERMISSION_DENIED",
        })
        expect(await stageOf(AN)).toBe("new")
    })

    it("lets only some of the writers that race for a deal write, and the others get a conflict or a refusal", async () => {
        const targets = ["qualified", "proposal", "new", "qualified", "proposal", "new", "qualified", "proposal"]
        const before = Number(await versionOf(seed.manager, "blocks-core.sales.lead", BINH))
        const answers = await Promise.all(targets.map((to) => door.act(OWNER, "sales.move-stage", { id: BINH, to })))
        const written = answers.filter((answer) => answer["ok"] === true).length
        const lost = answers.filter((answer) => answer["ok"] === false && answer["reason"] === "conflict").length
        const refused = answers.filter((answer) => answer["ok"] === false && answer["reason"] === "refused").length
        expect(written).toBeGreaterThanOrEqual(1)
        expect(written + lost + refused).toBe(targets.length)
        expect(Number(await versionOf(seed.manager, "blocks-core.sales.lead", BINH))).toBe(before + written)
    })
})

describe("the order actions", () => {
    it("lets the owner confirm the order at the owner threshold, which wins the customer's deal", async () => {
        expect(await door.act(OWNER, "sales.confirm-order", { id: BIG })).toEqual({ ok: true, data: { changed: true } })
        const order = await door.read(OWNER, "blocks-core.sales.order", { id: BIG })
        expect(order).toMatchObject({ status: "confirmed", approval: "done" })
        expect(typeof order["confirmedBy"]).toBe("string")
        expect(await stageOf(CHAU)).toBe("won")
        expect(await door.read(OWNER, "blocks-core.sales.api.order.waiting")).toMatchObject({ count: null, rows: [] })
    })

    it("confirms a small draft once, and changes nothing the second time", async () => {
        expect(await door.act(OWNER, "sales.confirm-order", { id: SMALL })).toEqual({
            ok: true,
            data: { changed: true },
        })
        expect(await door.act(OWNER, "sales.confirm-order", { id: SMALL })).toEqual({
            ok: true,
            data: { changed: false },
        })
        expect(await stageOf(AN)).toBe("won")
    })

    it("cancels a confirmed order that no payment or invoice touches, and then offers nothing more on it", async () => {
        expect(await door.read(OWNER, "blocks-core.sales.order", { id: CONFIRMED })).toMatchObject({
            status: "confirmed",
            canConfirm: false,
            canCancel: true,
        })
        expect(await door.act(OWNER, "sales.cancel-order", { id: CONFIRMED })).toEqual({ ok: true })
        expect(await door.read(OWNER, "blocks-core.sales.order", { id: CONFIRMED })).toMatchObject({
            status: "cancelled",
            canCancel: false,
        })
        expect(await door.act(OWNER, "sales.cancel-order", { id: CONFIRMED })).toMatchObject({
            ok: false,
            message: { key: "refusal_order_not_cancellable" },
        })
    })

    it("refuses to cancel a confirmed order that has a payment allocated, and leaves it confirmed", async () => {
        await saveRecord(seed.manager, scene.workspaceId, "blocks-core.sales.transaction", world.id(), {
            channel: "bank",
            direction: "credit",
            amountVnd: 6_000_000,
            orderId: BIG,
            status: "matched",
            occurredAt: "2026-11-05T09:00:00.000Z",
        })
        expect(await door.read(OWNER, "blocks-core.sales.order", { id: BIG })).toMatchObject({
            status: "confirmed",
            canCancel: false,
        })
        expect(await door.act(OWNER, "sales.cancel-order", { id: BIG })).toMatchObject({
            ok: false,
            message: { key: "refusal_order_has_payment" },
        })
        expect(await statusOf(BIG)).toBe("confirmed")
    })
})

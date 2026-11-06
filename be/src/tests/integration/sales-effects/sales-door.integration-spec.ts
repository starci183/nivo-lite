import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import {
    BINH_NAME,
    CONVERSATION_DATA,
    leadsLinkedTo,
    persistSalesDoorScene,
    saveRecord,
    salesDoorScene,
} from "../../fixtures/builders/sales-door.builder"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { versionOf } from "../../world/entity-engine-records.service"
import { API_APP_MODULES } from "../../world/api-app.options"
import { doorCallsOf, idsOfPage, registerSalesEffects, useSeedConnection } from "../../world/sales-door-world.service"
import type { DoorPayload } from "../../world/sales-door-world.service"
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
    registerSalesEffects(world)
})

const sorted = (ids: ReadonlyArray<string>): ReadonlyArray<string> => ids.toSorted((a, b) => a.localeCompare(b))

const idsOf = async (name: string, payload: DoorPayload = {}): Promise<ReadonlyArray<string>> =>
    idsOfPage(await door.read(OWNER, name, payload))

const stageOf = async (id: string): Promise<unknown> => (await door.read(OWNER, "sales.lead", { id }))["stage"]

const statusOf = async (id: string): Promise<unknown> => (await door.read(OWNER, "sales.order", { id }))["status"]

describe("the Sales workbench through the door, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })
})

describe("the customer lists", () => {
    it("lists the customers of the workspace only, and never another workspace's", async () => {
        const answer = await door.read(OWNER, "sales.leads")
        expect(sorted(idsOfPage(answer))).toEqual(sorted(scene.leads))
        expect(idsOfPage(answer)).not.toContain(scene.otherLeadId)
        expect(answer["cursor"]).toBeNull()
    })

    it("narrows by stage, sorts by name and searches without accents or case", async () => {
        expect(await idsOf("sales.leads", { stage: "new" })).toEqual([AN])
        expect(await idsOf("sales.leads", { sort: "name" })).toEqual([CHAU, AN, BINH])
        expect(await idsOf("sales.leads", { q: "tran thi binh" })).toEqual([BINH])
        expect(await idsOf("sales.leads", { q: "gift" })).toEqual([CHAU])
    })

    it("counts the customers of each stage under the same search", async () => {
        expect(await door.read(OWNER, "sales.lead-counts")).toMatchObject({
            counts: { new: 1, qualified: 1, proposal: 1 },
            total: 3,
        })
        expect(await door.read(OWNER, "sales.lead-counts", { q: "gift" })).toMatchObject({ total: 1 })
    })

    it("gives one customer with what the orders add up to, and nothing for another workspace's", async () => {
        expect(await door.read(OWNER, "sales.lead", { id: BINH })).toMatchObject({
            contactName: BINH_NAME,
            orderCount: 1,
            confirmedVnd: 300_000,
            latestOrderNo: "DH-20261104-0002",
            latestOrderStatus: "confirmed",
        })
        expect(await door.data(OWNER, "sales.lead", { id: scene.otherLeadId })).toBeNull()
    })
})

describe("the order lists", () => {
    it("lists the orders by amount, narrowed by status and searched by items, and counts each status", async () => {
        expect(await idsOf("sales.orders", { sort: "amount" })).toEqual([BIG, CONFIRMED, SMALL])
        expect(sorted(await idsOf("sales.orders", { status: "draft" }))).toEqual(sorted([SMALL, BIG]))
        expect(await idsOf("sales.orders", { q: "gift" })).toEqual([BIG])
        expect(await door.read(OWNER, "sales.order-counts")).toMatchObject({
            counts: { draft: 2, confirmed: 1 },
            total: 3,
        })
    })

    it("gives one order with its customer's name and who confirms it", async () => {
        expect(await door.read(OWNER, "sales.order", { id: BIG })).toMatchObject({
            orderNo: "DH-20261104-0003",
            customer: "Le Minh Chau",
            approval: "owner",
            thresholdVnd: 5_000_000,
        })
        expect(await door.read(OWNER, "sales.order", { id: SMALL })).toMatchObject({ approval: "shop" })
    })

    it("lists the order that waits for the owner with its customer joined and a link", async () => {
        const waiting = await door.read(OWNER, "sales.orders-waiting")
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
        await expect(door.read(STAFF, "sales.leads")).rejects.toMatchObject({
            code: "WORKBENCH_DOOR_PERMISSION_DENIED",
        })
        expect(await stageOf(AN)).toBe("new")
    })

    it("lets only some of the writers that race for a deal write, and the others get a conflict or a refusal", async () => {
        const targets = ["qualified", "proposal", "new", "qualified", "proposal", "new", "qualified", "proposal"]
        const before = Number(await versionOf(seed.manager, "sales.lead", BINH))
        const answers = await Promise.all(targets.map((to) => door.act(OWNER, "sales.move-stage", { id: BINH, to })))
        const written = answers.filter((answer) => answer["ok"] === true).length
        const lost = answers.filter((answer) => answer["ok"] === false && answer["reason"] === "conflict").length
        const refused = answers.filter((answer) => answer["ok"] === false && answer["reason"] === "refused").length
        expect(written).toBeGreaterThanOrEqual(1)
        expect(written + lost + refused).toBe(targets.length)
        expect(Number(await versionOf(seed.manager, "sales.lead", BINH))).toBe(before + written)
    })
})

describe("the order actions", () => {
    it("lets the owner confirm the order at the owner threshold, which wins the customer's deal", async () => {
        expect(await door.act(OWNER, "sales.confirm-order", { id: BIG })).toEqual({ ok: true, data: { changed: true } })
        const order = await door.read(OWNER, "sales.order", { id: BIG })
        expect(order).toMatchObject({ status: "confirmed", approval: "done" })
        expect(typeof order["confirmedBy"]).toBe("string")
        expect(await stageOf(CHAU)).toBe("won")
        expect(await door.read(OWNER, "sales.orders-waiting")).toMatchObject({ count: null, rows: [] })
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

    it("cancels a draft only, and answers a refusal as data otherwise", async () => {
        expect(await door.act(OWNER, "sales.cancel-order", { id: CONFIRMED })).toMatchObject({
            ok: false,
            message: { key: "refusal_order_not_cancellable" },
        })
        expect(await statusOf(CONFIRMED)).toBe("confirmed")
    })
})

const turnOf = (conversationId: string | null): NodeTurn => ({
    turnId: "t-1",
    workspaceId: scene.workspaceId,
    agentId: "agent-1",
    subject: null,
    conversationId,
    locale: "vi",
})

const run = (effect: string, payload: DoorPayload, conversationId: string | null = null) =>
    world
        .resolve(GraphNodeRegistryService)
        .executorOf(effect)
        .execute(turnOf(conversationId), payload, { key: `k-${world.id()}`, dedupeKey: null })

const conversation = async (): Promise<string> => {
    const id = world.id()
    await saveRecord(seed.manager, scene.workspaceId, "chat.conversation", id, CONVERSATION_DATA)
    return id
}

describe("the lead.ensure effect on the engine", () => {
    it("makes the customer of a conversation through the phone match key, and a second conversation of that phone gets the same one", async () => {
        const first = await conversation()
        const second = await conversation()
        const made = await run("lead.ensure", { conversationId: first, name: "Lan", phone: "0933 111 222" })
        const again = await run("lead.ensure", { conversationId: second, phone: "84933111222" })
        expect(made).toMatchObject({ kind: "sales-lead" })
        expect(again).toEqual(made)
        expect(await leadsLinkedTo(seed.manager, first)).toEqual([made.id])
        expect(await leadsLinkedTo(seed.manager, second)).toEqual([made.id])
        expect(await door.read(OWNER, "sales.lead", { id: made.id })).toMatchObject({
            contactName: "Lan",
            channel: "zalo",
            stage: "new",
            phone: "84933111222",
        })
    })

    it("answers the customer a conversation is linked to without making a second, and tells the turn who it is", async () => {
        const id = await conversation()
        const made = await run("lead.ensure", { conversationId: id })
        expect(await run("lead.ensure", { conversationId: id, name: "Other" })).toEqual(made)
        expect(await door.read(OWNER, "sales.lead", { id: made.id })).toMatchObject({
            contactName: "Guest 7",
            phone: null,
        })
        const resolvers = world.resolve(GraphNodeRegistryService).subjectResolvers()
        const subjects = await Promise.all(resolvers.map((resolver) => resolver.subjectOf(turnOf(id))))
        expect(subjects).toContainEqual(made)
    })

    it("refuses a conversation the workspace does not have", async () => {
        await expect(run("lead.ensure", { conversationId: world.id() })).rejects.toMatchObject({
            code: "SALES_EFFECTS_CONVERSATION_NOT_FOUND",
        })
    })
})

describe("the order effects on the engine", () => {
    it("records a numbered draft for the customer and confirms it once, which wins the deal", async () => {
        const items = [
            { name: "tea", qty: 2 },
            { name: "cake", qty: 1 },
        ]
        const recorded = await run("order.record", {
            leadId: BINH,
            items,
            amountVnd: 150_000,
            note: "Leave at the door",
        })
        const order = await door.read(OWNER, "sales.order", { id: recorded.id })
        expect(order["orderNo"]).toMatch(/^DH-\d{8}-\d{4}$/)
        expect(order).toMatchObject({
            customer: BINH_NAME,
            items: "2 x tea, 1 x cake",
            note: "Leave at the door",
            amountVnd: 150_000,
            status: "draft",
            leadId: BINH,
        })
        expect(await run("order.confirm", { orderId: recorded.id })).toEqual(recorded)
        expect(await door.read(OWNER, "sales.order", { id: recorded.id })).toMatchObject({
            status: "confirmed",
            confirmedBy: "NIVO",
        })
        expect(await stageOf(BINH)).toBe("won")
        expect(await run("order.confirm", { orderId: recorded.id })).toEqual(recorded)
    })

    it("cuts a draft short, once, and keeps its fields", async () => {
        const draft = await run("order.record", { leadId: AN, items: [{ name: "tea", qty: 1 }], amountVnd: null })
        expect(await run("order.void", { id: draft.id })).toEqual(draft)
        expect(await statusOf(draft.id)).toBe("failed_system")
        expect(await run("order.void", { id: draft.id })).toEqual(draft)
        expect(await door.read(OWNER, "sales.order", { id: draft.id })).toMatchObject({
            items: "1 x tea",
            amountVnd: null,
        })
    })

    it("refuses a customer of another workspace", async () => {
        await expect(
            run("order.record", { leadId: scene.otherLeadId, items: [{ name: "tea", qty: 1 }], amountVnd: 1 }),
        ).rejects.toMatchObject({ code: "SALES_EFFECTS_LEAD_NOT_FOUND" })
    })
})

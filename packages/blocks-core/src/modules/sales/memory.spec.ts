import type { ListFilter, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import type { EntityApi, EntityQuery } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { definePort, portsOf } from "@nivo-lite/agent-sdk/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import { rightsPort } from "../platform/ports"
import { ORDER_WAITING, sampleState, SAMPLE_NOW } from "./fixtures/sales.data"
import { memoryProvider } from "./memory"
import { salesLeads, salesLeadsList, salesOrders, salesOrdersList, salesSettings } from "./ports"
import { LEADS_LIST } from "./reads/leads.read"
import { ORDERS_LIST } from "./reads/orders.read"
import type { LeadRow, OrderRow } from "./sales.types"

const query = (overrides: Partial<ListQuery> = {}): ListQuery => ({
    q: null,
    filters: {},
    sort: "recent",
    cursor: null,
    size: 30,
    ...overrides,
})

interface Sources {
    readonly leads: ListSource<LeadRow>
    readonly orders: ListSource<OrderRow>
}

const sources = (holders: ReadonlyArray<string> = []): Sources =>
    portsOf(memoryProvider(sampleState(holders)), { leads: salesLeadsList, orders: salesOrdersList })

describe("the in-memory list source", () => {
    it("sorts the leads by the chosen key, newest change first by default", async () => {
        const { leads } = sources()
        const page = await leads.page(LEADS_LIST, query({ sort: "name" }))
        expect(page.rows.map((lead) => lead.contactName)).toEqual([
            "Ho\u00e0ng Thu H\u00e0",
            "L\u00ea Minh Ch\u00e2u",
            "Nguy\u1ec5n V\u0103n An",
            "Ph\u1ea1m Qu\u1ed1c D\u0169ng",
            "Tr\u1ea7n Th\u1ecb B\u00ecnh",
        ])
        expect(page.cursor).toBeNull()
    })

    it("sorts the orders by amount, largest first, comparing numbers as numbers", async () => {
        const { orders } = sources()
        const page = await orders.page(ORDERS_LIST, query({ sort: "amount" }))
        expect(page.rows[0]?.amountVnd).toBe(6_000_000)
        expect(page.rows.at(-1)?.amountVnd).toBe(100_000)
    })

    it("searches without accents or case across the declared fields", async () => {
        const { leads } = sources()
        const page = await leads.page(LEADS_LIST, query({ q: "NGUYEN van" }))
        expect(page.rows.map((lead) => lead.id)).toEqual(["lead-1"])
        const byNeed = await leads.page(LEADS_LIST, query({ q: "c\u01b0\u1edbi" }))
        expect(byNeed.rows.map((lead) => lead.id)).toEqual(["lead-3"])
    })

    it("narrows by an enumerated filter", async () => {
        const { leads } = sources()
        const page = await leads.page(LEADS_LIST, query({ filters: { stage: "new" } }))
        expect(page.rows.map((lead) => lead.id).sort()).toEqual(["lead-1", "lead-2"])
    })

    it("pages by an opaque cursor", async () => {
        const { leads } = sources()
        const first = await leads.page(LEADS_LIST, query({ size: 2, sort: "name" }))
        expect(first.rows).toHaveLength(2)
        expect(first.cursor).toBe("2")
        const last = await leads.page(LEADS_LIST, query({ size: 2, sort: "name", cursor: "4" }))
        expect(last.rows).toHaveLength(1)
        expect(last.cursor).toBeNull()
    })

    it("keeps the stored order when the sort key is unknown", async () => {
        const { leads } = sources()
        const page = await leads.page(LEADS_LIST, query({ sort: "nope" }))
        expect(page.rows.map((lead) => lead.id)).toEqual(["lead-1", "lead-2", "lead-3", "lead-4", "lead-5"])
    })

    it("counts every value of a filter under the search and the other filters, not its own", async () => {
        const { leads, orders } = sources()
        expect(await leads.counts(LEADS_LIST, "stage", query({ filters: { stage: "won" } }))).toEqual({
            new: 2,
            qualified: 1,
            proposal: 1,
            won: 1,
            lost: 0,
        })
        expect(await leads.counts(LEADS_LIST, "stage", query({ q: "tran" }))).toEqual({
            new: 1,
            qualified: 0,
            proposal: 0,
            won: 0,
            lost: 0,
        })
        const byStatus = await orders.counts(ORDERS_LIST, "status", query())
        expect(byStatus).toMatchObject({ draft: 2, confirmed: 1, paid: 2, cancelled: 1, invoiced: 0 })
    })

    it("counts nothing for a filter the shape does not have", async () => {
        const { leads } = sources()
        expect(await leads.counts(LEADS_LIST, "owner", query())).toEqual({})
    })

    it("serves lists without a search, and leaves a filter of named cases or an unknown filter unapplied", async () => {
        const stock: ListFilter = { cases: { low: { field: "x", op: "lte", ref: "y" } } }
        const shape: ListShape = {
            filters: { stock },
            sort: { recent: [["id", "asc"]] },
            page: { size: 30 },
            row: { id: "id", title: "contactName" },
        }
        const { leads } = sources()
        const page = await leads.page(shape, query({ filters: { stock: "low", ghost: "x" }, sort: "recent" }))
        expect(page.rows).toHaveLength(5)
    })
})

const ORDER_ROWS: EntityQuery = {
    select: ["orderNo", "status", "amountVnd", "leadId"],
    order: [
        ["createdAt", "asc"],
        ["id", "asc"],
    ],
    page: { size: 10 },
}

const ordersOf = (state = sampleState([])): EntityApi => portsOf(memoryProvider(state), { orders: salesOrders }).orders

describe("the in-memory lead port", () => {
    it("reads a lead as the record the engine holds", async () => {
        const { leads } = portsOf(memoryProvider(sampleState([])), { leads: salesLeads })
        expect(await leads.get("lead-1")).toMatchObject({
            id: "lead-1",
            version: "1",
            updatedAt: "2026-11-04T08:00:00.000Z",
            data: { contactName: "Nguy\u1ec5n V\u0103n An", stage: "new", closedReason: null },
        })
        expect(await leads.get("lead-404")).toBeNull()
    })

    it("updates a lead under its version, bumps the version and stamps the clock", async () => {
        const state = sampleState([])
        const { leads } = portsOf(memoryProvider(state), { leads: salesLeads })
        expect(await leads.update("lead-1", "1", { stage: "qualified" })).toMatchObject({
            ok: true,
            row: { version: "2", updatedAt: SAMPLE_NOW, data: { stage: "qualified" } },
        })
        expect(state.leads.find((lead) => lead.id === "lead-1")).toMatchObject({ stage: "qualified", version: "2" })
        expect(await leads.update("lead-1", "1", { stage: "lost" })).toEqual({ ok: false, reason: "stale" })
        expect(await leads.update("lead-404", "1", { stage: "lost" })).toEqual({ ok: false, reason: "missing" })
    })

    it("refuses a write that makes the record no lead", async () => {
        const { leads } = portsOf(memoryProvider(sampleState([])), { leads: salesLeads })
        expect(await leads.update("lead-1", "1", { stage: "contacted" })).toEqual({ ok: false, reason: "invalid" })
    })

    it("refuses the calls it does not run", async () => {
        const { leads } = portsOf(memoryProvider(sampleState([])), { leads: salesLeads })
        await expect(leads.insert({ contactName: "x" })).rejects.toThrow("does not run")
    })

    it("carries the selected fields only", async () => {
        const { leads } = portsOf(memoryProvider(sampleState([])), { leads: salesLeads })
        const page = await leads.list({
            select: ["contactName"],
            where: q.eq("stage", "new"),
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 1 },
        })
        expect(Object.keys(page.rows[0]?.row.data ?? {})).toEqual(["contactName"])
        expect(page.rows[0]?.joined).toEqual({})
    })
})

describe("the in-memory order port", () => {
    it("lists the orders of a customer newest first through the index the engine has", async () => {
        const page = await ordersOf().list({
            select: ["orderNo", "status", "amountVnd"],
            where: q.eq("leadId", "lead-4"),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 10 },
        })
        expect(page.rows.map((listed) => listed.row.id)).toEqual(["order-1"])
        expect(page.next).toBeNull()
    })

    it("lists the orders that wait for the owner, oldest first, with the customer joined", async () => {
        const page = await ordersOf().list({
            ...ORDER_ROWS,
            join: { lead: ["contactName"] },
            where: q.and(q.eq("status", "draft"), q.or(q.isNull("amountVnd"), q.gte("amountVnd", 5_000_000))),
        })
        expect(page.rows.map((listed) => [listed.row.id, listed.joined["lead"]?.data["contactName"]])).toEqual([
            ["order-1", "Ph\u1ea1m Qu\u1ed1c D\u0169ng"],
        ])
    })

    it("joins none for an order with no customer or whose customer is gone", async () => {
        const state = sampleState([])
        state.orders.push(
            { ...ORDER_WAITING, id: "order-9", leadId: "lead-9", createdAt: "2026-12-01T00:00:00.000Z" },
            { ...ORDER_WAITING, id: "order-8", leadId: null, createdAt: "2026-12-01T00:00:00.000Z" },
        )
        const page = await ordersOf(state).list({
            ...ORDER_ROWS,
            join: { lead: ["contactName"] },
            where: q.eq("status", "draft"),
        })
        expect(page.rows.slice(-2).map((listed) => listed.joined["lead"])).toEqual([null, null])
    })

    it("pages by the cursor it hands out", async () => {
        const orders = ordersOf()
        const first = await orders.list({ ...ORDER_ROWS, page: { size: 2 } })
        expect(first.rows).toHaveLength(2)
        expect(first.next).toBe("2")
        const rest = await orders.list({ ...ORDER_ROWS, page: { size: 10, after: first.next ?? "" } })
        expect(rest.rows).toHaveLength(5)
        expect(rest.next).toBeNull()
    })

    it("counts the orders a condition matches", async () => {
        const waiting = q.and(q.eq("status", "draft"), q.or(q.isNull("amountVnd"), q.gte("amountVnd", 300_000)))
        expect(
            await ordersOf().aggregate({ where: waiting, measures: { count: { kind: "count" } }, limit: 1 }),
        ).toEqual([{ groups: {}, measures: { count: 2 } }])
    })

    it("refuses a query the planner refuses, as the engine would", async () => {
        await expect(
            ordersOf().list({
                ...ORDER_ROWS,
                where: q.eq("note", "x"),
                order: [
                    ["note", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).rejects.toThrow("The planner refuses the query")
    })

    it("refuses a condition it does not run", async () => {
        await expect(ordersOf().list({ ...ORDER_ROWS, where: q.search(["note"], "x") })).rejects.toThrow(
            "does not run the condition",
        )
        await expect(
            ordersOf().aggregate({
                where: q.search(["note"], "x"),
                measures: { count: { kind: "count" } },
                limit: 1,
            }),
        ).rejects.toThrow("does not run the condition")
        await expect(
            ordersOf().list({ ...ORDER_ROWS, where: q.and(q.eq("status", "draft"), q.search(["note"], "x")) }),
        ).rejects.toThrow("does not run the condition")
    })

    it("reads an order and updates it under its version", async () => {
        const orders = ordersOf()
        expect((await orders.get("order-2"))?.data["orderNo"]).toBe("DH-20261104-0002")
        expect(await orders.get("order-404")).toBeNull()
        expect(await orders.update("order-2", "1", { status: "cancelled" })).toMatchObject({ ok: true })
    })
})

describe("the in-memory rights", () => {
    it("grant rights to the listed members only, never to the agent", async () => {
        const { rights } = portsOf(memoryProvider(sampleState(["owner-1"])), { rights: rightsPort })
        expect(await rights.holds("owner-1", "sales.approve")).toBe(true)
        expect(await rights.holds("staff-1", "sales.approve")).toBe(false)
        expect(await rights.holds(null, "sales.approve")).toBe(false)
    })

    it("refuse a port it does not serve", () => {
        const other = definePort<string>("sales.other")
        expect(() => portsOf(memoryProvider(sampleState([])), { other })).toThrow("PORT_UNPROVIDED")
    })
})

const SETTINGS_VALUES = { ...SALES_SETTINGS_DEFAULTS, key: "sales", approvalThresholdVnd: 1_000_000 }

describe("the in-memory engine conditions, aggregates and settings", () => {
    const orders = (): EntityApi => ordersOf()
    const idsWhere = async (where: FilterExpr): Promise<ReadonlyArray<string>> =>
        (await orders().list({ ...ORDER_ROWS, where })).rows.map((listed) => listed.row.id).sort()

    it("compares numbers and texts, and nothing else, with lt, lte, gt and gte", async () => {
        expect(await idsWhere(q.lt("amountVnd", 240_000))).toEqual(["order-6"])
        expect(await idsWhere(q.lte("amountVnd", 240_000))).toEqual(["order-5", "order-6"])
        expect(await idsWhere(q.gt("amountVnd", 4_800_000))).toEqual(["order-1"])
        expect(await idsWhere(q.gte("createdAt", "2026-11-04T08:30:00.000Z"))).toHaveLength(7)
        expect(await idsWhere(q.lt("createdAt", "2026-11-04T08:30:00.000Z"))).toEqual([])
        expect(await idsWhere(q.gt("confirmedAt", "2026-01-01T00:00:00.000Z"))).toEqual([
            "order-3",
            "order-4",
            "order-6",
            "order-7",
        ])
    })

    it("runs ne, in, not, notNull and isNull", async () => {
        expect(await idsWhere(q.ne("status", "paid"))).toHaveLength(5)
        expect(await idsWhere(q.in("status", ["cancelled", "confirmed"]))).toEqual(["order-3", "order-5"])
        expect(await idsWhere(q.not(q.notNull("leadId")))).toEqual(["order-6"])
        expect(await idsWhere(q.isNull("leadId"))).toEqual(["order-6"])
    })

    it("sums and counts under the condition of a measure, and groups by a field", async () => {
        const totals = await orders().aggregate({
            groupBy: ["status"],
            measures: {
                all: { kind: "count" },
                amount: { kind: "sum", field: "amountVnd" },
                big: { kind: "count", where: q.gte("amountVnd", 1_000_000) },
            },
            limit: 10,
        })
        const paid = totals.find((row) => row.groups["status"] === "paid")
        expect(paid?.measures).toEqual({ all: 2, amount: 1_300_000, big: 1 })
        const whole = await orders().aggregate({ measures: { amount: { kind: "sum", field: "amountVnd" } }, limit: 1 })
        expect(whole).toEqual([{ groups: {}, measures: { amount: 13_660_000 } }])
    })

    it("keeps the settings as one record: a save makes it, an update changes it, a bad one is refused", async () => {
        const state = sampleState([])
        const provided = portsOf(memoryProvider(state), { settings: salesSettings }).settings
        expect(await provided.get("settings-1")).toBeNull()
        expect((await provided.upsert("key_key", SETTINGS_VALUES)).ok).toBe(true)
        expect(state.settings?.approvalThresholdVnd).toBe(1_000_000)
        expect((await provided.update("settings-1", "1", { closedDealsCanFlip: false })).ok).toBe(true)
        expect(state.settings?.closedDealsCanFlip).toBe(false)
        expect((await provided.update("settings-1", "1", { approvalThresholdVnd: "many" })).ok).toBe(false)
        expect((await provided.upsert("key_key", { ...SETTINGS_VALUES, approvalThresholdVnd: -5 })).ok).toBe(false)
    })

    it("refuses a negation of a condition it does not run", async () => {
        await expect(ordersOf().list({ ...ORDER_ROWS, where: q.not(q.search(["note"], "x")) })).rejects.toThrow(
            "does not run the condition",
        )
    })

    it("takes no upsert on the other tables", async () => {
        expect((await orders().upsert("order_no_key", {})).ok).toBe(false)
    })
})

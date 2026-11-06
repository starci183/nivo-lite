import type { ListFilter, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import { definePort, portsOf } from "@nivo-lite/agent-sdk/port"
import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import { ORDER_WAITING, sampleState, SAMPLE_NOW } from "./fixtures/sales.data"
import { memoryProvider } from "./memory"
import { salesLeadStore, salesLeadsList, salesOrderStore, salesOrdersList, salesRights, salesSettings } from "./ports"
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
        const byNeed = await leads.page(LEADS_LIST, query({ q: "DAM cuoi" }))
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

describe("the in-memory stores", () => {
    it("reads and updates a lead under its version, and bumps the version", async () => {
        const state = sampleState([])
        const { leads } = portsOf(memoryProvider(state), { leads: salesLeadStore })
        expect((await leads.get("lead-1"))?.contactName).toBe("Nguy\u1ec5n V\u0103n An")
        expect(await leads.get("lead-404")).toBeNull()
        const written = await leads.update("lead-1", "1", { stage: "qualified" })
        expect(written).toMatchObject({ ok: true, row: { stage: "qualified", version: "2", updatedAt: SAMPLE_NOW } })
        expect(state.leads.find((lead) => lead.id === "lead-1")?.stage).toBe("qualified")
        expect(await leads.update("lead-1", "1", { stage: "lost" })).toEqual({ ok: false, reason: "conflict" })
        expect(await leads.update("lead-404", "1", { stage: "lost" })).toEqual({ ok: false, reason: "missing" })
    })

    it("names the leads that exist", async () => {
        const { leads } = portsOf(memoryProvider(sampleState([])), { leads: salesLeadStore })
        expect(await leads.names(["lead-1", "lead-9"])).toEqual({ "lead-1": "Nguy\u1ec5n V\u0103n An" })
    })

    it("lists the orders of a customer newest first and the orders that wait for the owner oldest first", async () => {
        const { orders } = portsOf(memoryProvider(sampleState([])), { orders: salesOrderStore })
        expect((await orders.ofLead("lead-4", 10)).map((order) => order.id)).toEqual(["order-1"])
        expect(await orders.waiting(SALES_SETTINGS_DEFAULTS, 10)).toMatchObject({
            total: 1,
            rows: [{ id: "order-1" }],
        })
        expect(await orders.waiting({ ...SALES_SETTINGS_DEFAULTS, approvalThresholdVnd: 300_000 }, 1)).toMatchObject({
            total: 2,
        })
        expect((await orders.get("order-2"))?.orderNo).toBe("DH-20261104-0002")
        expect(await orders.get("order-404")).toBeNull()
        expect(await orders.update("order-2", "1", { status: "cancelled" })).toMatchObject({ ok: true })
    })

    it("sorts a customer's orders by their creation", async () => {
        const state = sampleState([])
        state.orders.push({ ...ORDER_WAITING, id: "order-9", leadId: "lead-4", createdAt: "2026-11-05T01:00:00.000Z" })
        const { orders } = portsOf(memoryProvider(state), { orders: salesOrderStore })
        expect((await orders.ofLead("lead-4", 10)).map((order) => order.id)).toEqual(["order-9", "order-1"])
    })

    it("keeps the settings a save wrote, and none before the first save", async () => {
        const { settings } = portsOf(memoryProvider(sampleState([])), { settings: salesSettings })
        expect(await settings.get()).toBeNull()
        const saved = { ...SALES_SETTINGS_DEFAULTS, closedDealsCanFlip: false }
        expect(await settings.save(saved)).toEqual(saved)
        expect(await settings.get()).toEqual(saved)
    })

    it("grants rights to the listed members only, never to the agent", async () => {
        const { rights } = portsOf(memoryProvider(sampleState(["owner-1"])), { rights: salesRights })
        expect(await rights.holds("owner-1", "sales.approve")).toBe(true)
        expect(await rights.holds("staff-1", "sales.approve")).toBe(false)
        expect(await rights.holds(null, "sales.approve")).toBe(false)
    })

    it("refuses a port it does not serve", () => {
        const other = definePort<string>("sales.other")
        expect(() => portsOf(memoryProvider(sampleState([])), { other })).toThrow("PORT_UNPROVIDED")
    })
})

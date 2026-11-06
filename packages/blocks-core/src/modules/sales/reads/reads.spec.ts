import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { ORDER_WAITING, sampleState, SAMPLE_NOW } from "../fixtures/sales.data"
import { salesContextOf } from "../fixtures/sales.context"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { leadRead } from "./lead.read"
import { leadCountsRead, leadsRead } from "./leads.read"
import { orderRead } from "./order.read"
import { orderCountsRead, ordersRead } from "./orders.read"
import { ordersWaitingRead, waitingHrefOf } from "./orders-waiting.read"

const CONTEXT = salesContextOf()

const page = z.object({
    rows: z.array(z.object({ id: z.string().max(100) })).max(100),
    cursor: z.string().max(100).nullable(),
})

const run = (read: ReadDefinition, raw: unknown, state: MemoryState = sampleState([])): Promise<ReadRunResult> => {
    return read.execute?.(memoryProvider(state), raw, CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
}

/** A provider whose entity port under `portId` answers as the given calls say, the rest as the memory does. */
const overriding = (state: MemoryState, portId: string, calls: Partial<EntityApi>): PortProvider => {
    const provider = memoryProvider(state)
    return {
        implementationOf: (port) => {
            const implementation = provider.implementationOf(port)
            if (port.id !== portId || typeof implementation !== "object" || implementation === null)
                return implementation
            return { ...implementation, ...calls }
        },
    }
}

const dataFrom = async (read: ReadDefinition, provider: PortProvider, raw: unknown): Promise<unknown> => {
    const result = (await read.execute?.(provider, raw, CONTEXT)) ?? { ok: false, problems: [] }
    return result.ok ? result.data : result.problems
}

const NOT_AN_ORDER = {
    row: {
        id: "x",
        workspaceId: "w1",
        version: "1",
        createdAt: SAMPLE_NOW,
        updatedAt: SAMPLE_NOW,
        data: { status: "lost" },
    },
    joined: {},
    position: [],
    included: {},
}

const dataOf = async (read: ReadDefinition, raw: unknown, state?: MemoryState): Promise<unknown> => {
    const result = await run(read, raw, state)
    return result.ok ? result.data : result.problems
}

const idsOf = async (read: ReadDefinition, raw: unknown): Promise<ReadonlyArray<string>> =>
    page.parse(await dataOf(read, raw)).rows.map((row) => row.id)

describe("sales.leads", () => {
    it("lists a page of leads", async () => {
        expect(page.parse(await dataOf(leadsRead, {}))).toMatchObject({ cursor: null })
        expect(await idsOf(leadsRead, {})).toHaveLength(5)
    })

    it("searches, filters by stage and sorts through its variables", async () => {
        expect(await idsOf(leadsRead, { q: "  tran ", stage: "new", sort: "name" })).toEqual(["lead-2"])
    })

    it("takes the all tab as no filter", async () => {
        expect(await idsOf(leadsRead, { stage: "all" })).toHaveLength(5)
    })

    it("refuses a stage that is no stage and a variable it does not declare", async () => {
        expect(await run(leadsRead, { stage: "contacted" })).toEqual({
            ok: false,
            problems: [{ code: "INPUT_INVALID", at: "stage" }],
        })
        expect(await run(leadsRead, { owner: "x" })).toMatchObject({ ok: false })
    })

    it("declares the list with its default sort and the view permission", () => {
        expect(leadsRead.listing).toMatchObject({ kind: "list", defaultSort: "recent" })
        expect(leadsRead.permission).toBe("sales.view")
    })
})

describe("sales.lead-counts", () => {
    it("counts the leads of each stage with their sum, under the same search", async () => {
        expect(await dataOf(leadCountsRead, {})).toEqual({
            counts: { new: 2, qualified: 1, proposal: 1, won: 1, lost: 0 },
            total: 5,
        })
        expect(await dataOf(leadCountsRead, { q: "c\u01b0\u1edbi" })).toMatchObject({ total: 1 })
    })
})

describe("sales.lead", () => {
    it("gives one lead with what its orders add up to", async () => {
        expect(await dataOf(leadRead, { id: "lead-4" })).toMatchObject({
            id: "lead-4",
            stage: "proposal",
            orderCount: 1,
            confirmedVnd: 0,
            latestOrderNo: "DH-20261104-0001",
            latestOrderStatus: "draft",
            latestOrderAmountVnd: 6_000_000,
        })
    })

    it("gives a lead with no order zero orders and no latest one", async () => {
        expect(await dataOf(leadRead, { id: "lead-2" })).toMatchObject({
            orderCount: 0,
            confirmedVnd: 0,
            latestOrderNo: null,
            latestOrderStatus: null,
            latestOrderAmountVnd: null,
        })
    })

    it("gives null for a lead the workspace does not have", async () => {
        expect(await dataOf(leadRead, { id: "lead-404" })).toBeNull()
    })

    it("refuses a missing id", async () => {
        expect(await run(leadRead, {})).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "id" }] })
    })

    it("leaves out a record of its orders that is no order", async () => {
        const provider = overriding(sampleState([]), "engine.entity.sales.order", {
            list: () => Promise.resolve({ rows: [NOT_AN_ORDER], next: null }),
        })
        expect(await dataFrom(leadRead, provider, { id: "lead-4" })).toMatchObject({ orderCount: 0 })
    })
})

describe("sales.orders", () => {
    it("lists the orders narrowed by status and searched by items", async () => {
        expect([...(await idsOf(ordersRead, { status: "draft" }))].sort()).toEqual(["order-1", "order-2"])
        expect(await idsOf(ordersRead, { q: "tr\u00e0" })).toEqual(["order-2", "order-7"])
    })

    it("counts the orders of each status", async () => {
        expect(await dataOf(orderCountsRead, { q: "qu\u00e0" })).toMatchObject({
            counts: { draft: 1, confirmed: 1, paid: 1 },
            total: 3,
        })
    })
})

describe("sales.order", () => {
    it("gives an order with its customer and says the owner decides a big draft", async () => {
        expect(await dataOf(orderRead, { id: "order-1" })).toMatchObject({
            orderNo: "DH-20261104-0001",
            customer: "Ph\u1ea1m Qu\u1ed1c D\u0169ng",
            approval: "owner",
            thresholdVnd: 5_000_000,
        })
    })

    it("says the shop decides a small draft and that a confirmed order is done", async () => {
        expect(await dataOf(orderRead, { id: "order-2" })).toMatchObject({ approval: "shop" })
        expect(await dataOf(orderRead, { id: "order-3" })).toMatchObject({ approval: "done" })
    })

    it("has no customer name for an order with no customer or whose customer is gone", async () => {
        expect(await dataOf(orderRead, { id: "order-6" })).toMatchObject({ customer: null, leadId: null })
        expect(await dataOf(orderRead, { id: "order-5" })).toMatchObject({ customer: null, leadId: "lead-9" })
    })

    it("gives null for an order the workspace does not have", async () => {
        expect(await dataOf(orderRead, { id: "order-404" })).toBeNull()
    })
})

describe("sales.orders-waiting", () => {
    it("lists the draft orders at the owner threshold, with the customer and a link to the order", async () => {
        expect(await dataOf(ordersWaitingRead, {})).toEqual({
            count: "1",
            rows: [
                {
                    id: "order-1",
                    title: "DH-20261104-0001 \u00b7 Ph\u1ea1m Qu\u1ed1c D\u0169ng",
                    description: "10 x h\u1ed9p qu\u00e0 \u00b7 6.000.000\u00a0\u20ab",
                    href: "?tab=orders&order=order-1",
                },
            ],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })

    it("lists an order that has no customer without asking for any name", async () => {
        const state = sampleState([])
        state.orders.splice(0, state.orders.length, { ...ORDER_WAITING, leadId: null })
        expect(await dataOf(ordersWaitingRead, {}, state)).toMatchObject({
            count: "1",
            rows: [{ id: "order-1", title: "DH-20261104-0001" }],
        })
    })

    it("lists an order whose customer is gone without a name", async () => {
        const state = sampleState([])
        state.orders.splice(0, state.orders.length, { ...ORDER_WAITING, leadId: "lead-9" })
        expect(await dataOf(ordersWaitingRead, {}, state)).toMatchObject({
            rows: [{ id: "order-1", title: "DH-20261104-0001" }],
        })
    })

    it("says nothing waits when no order does", async () => {
        const state = sampleState([])
        state.orders.splice(0, state.orders.length)
        expect(await dataOf(ordersWaitingRead, {}, state)).toEqual({
            count: null,
            rows: [],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })

    it("leaves out a record that is no order and counts the rows it listed when the engine answers no count", async () => {
        const provider = overriding(sampleState([]), "engine.entity.sales.order", {
            list: () => Promise.resolve({ rows: [NOT_AN_ORDER], next: null }),
            aggregate: () => Promise.resolve([]),
        })
        expect(await dataFrom(ordersWaitingRead, provider, {})).toEqual({
            count: null,
            rows: [],
            linkLabel: "",
            linkHref: "",
            more: null,
        })
    })

    it("encodes the id in the link", () => {
        expect(waitingHrefOf("a b")).toBe("?tab=orders&order=a%20b")
    })
})

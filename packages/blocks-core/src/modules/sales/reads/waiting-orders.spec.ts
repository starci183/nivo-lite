import { SALES_SETTINGS_DEFAULTS } from "../../../rules/sales/settings"
import { LEAD_PROPOSAL, ORDER_WAITING } from "../fixtures/sales.data"
import type { LeadStore, OrderStore, SettingsStore } from "../ports"
import { waitingOrdersOf } from "./waiting-orders"

const leadsOf = (names: Readonly<Record<string, string>>): LeadStore => ({
    get: () => Promise.resolve(null),
    update: () => Promise.resolve({ ok: false, reason: "missing" }),
    names: () => Promise.resolve(names),
    awaitingReply: () => Promise.resolve([]),
})

const ordersOf = (rows: ReadonlyArray<typeof ORDER_WAITING>): OrderStore => ({
    get: () => Promise.resolve(null),
    update: () => Promise.resolve({ ok: false, reason: "missing" }),
    ofLead: () => Promise.resolve([]),
    waiting: () => Promise.resolve({ rows, total: rows.length + 2 }),
    failedSteps: () => Promise.resolve([]),
})

const SETTINGS: SettingsStore = {
    get: () => Promise.resolve(SALES_SETTINGS_DEFAULTS),
    save: (settings) => Promise.resolve(settings),
}

describe("waitingOrdersOf", () => {
    it("names the customer of each waiting order and counts every order that waits", async () => {
        const waiting = await waitingOrdersOf({
            leads: leadsOf({ [LEAD_PROPOSAL.id]: LEAD_PROPOSAL.contactName }),
            orders: ordersOf([ORDER_WAITING]),
            settings: SETTINGS,
        })
        expect(waiting.total).toBe(3)
        expect(waiting.rows).toEqual([
            {
                id: ORDER_WAITING.id,
                orderNo: ORDER_WAITING.orderNo,
                items: ORDER_WAITING.items,
                amountVnd: ORDER_WAITING.amountVnd,
                customer: "Ph\u1ea1m Qu\u1ed1c D\u0169ng",
            },
        ])
    })

    it("leaves the customer empty for an order with none or whose customer is gone", async () => {
        const none = { ...ORDER_WAITING, leadId: null }
        const gone = { ...ORDER_WAITING, id: "order-9", leadId: "lead-9" }
        const waiting = await waitingOrdersOf({
            leads: leadsOf({}),
            orders: ordersOf([none, gone]),
            settings: SETTINGS,
        })
        expect(waiting.rows.map((row) => row.customer)).toEqual([null, null])
    })

    it("asks for no names when no order has a customer", async () => {
        const waiting = await waitingOrdersOf({
            leads: leadsOf({}),
            orders: ordersOf([{ ...ORDER_WAITING, leadId: null }]),
            settings: SETTINGS,
        })
        expect(waiting.rows).toHaveLength(1)
    })
})

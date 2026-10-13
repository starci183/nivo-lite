import { Test } from "@nestjs/testing"
import { builder, FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OrdersErrorCode } from "./errors/orders.error"
import type { NewOrderDraft } from "./orders.contracts"
import { OrdersService } from "./orders.service"
import type { OrdersWorkbenchRow, SalesOrderListRow, SalesOrderRow } from "./persistence/orders.rows"
import {
    CANCEL_ORDER,
    CONFIRM_ORDER,
    COUNT_ORDERS_WITH_PREFIX,
    FIND_ORDER,
    FIND_ORDER_LABELS,
    INSERT_ORDER_DRAFT,
    LIST_LEAD_ORDERS,
    LIST_ORDERS,
    LIST_WORKBENCH_ORDERS,
    SET_ORDER_STATUS,
    SHIP_ORDER,
} from "./persistence/orders.sql"

const NOW = "2026-10-13T02:00:00.000Z"

const orderOf = builder<SalesOrderRow>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-20261013-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "draft",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-13T01:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

const draftOf = builder<NewOrderDraft>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    inboundEventId: "event-1",
    orderNo: null,
    items: "2 x Tea",
    amountVnd: 90000,
    origin: "live",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrdersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(OrdersService)
}

describe("OrdersService", () => {
    describe("find", () => {
        it("answers the order of the workspace", async () => {
            const em = mockEntityManager({ query: [FIND_ORDER, [orderOf()]] })
            const orders = await build(em)

            await expect(orders.find("ws-1", "order-1")).resolves.toEqual(orderOf())
            expect(em.query).toHaveBeenCalledWith(FIND_ORDER, ["ws-1", "order-1"])
        })

        it("answers null for an order the workspace does not have", async () => {
            const orders = await build(mockEntityManager({ query: [FIND_ORDER, []] }))

            await expect(orders.find("ws-1", "missing")).resolves.toBeNull()
        })
    })

    describe("list", () => {
        it("caps a large page at 500 orders", async () => {
            const row: SalesOrderListRow = { ...orderOf(), contact_name: "Minh", company: null }
            const em = mockEntityManager({ query: [LIST_ORDERS, [row]] })
            const orders = await build(em)

            await expect(orders.list("ws-1", 9999)).resolves.toEqual([row])
            expect(em.query).toHaveBeenCalledWith(LIST_ORDERS, ["ws-1", 500])
        })

        it("reads at least one order and 200 by default", async () => {
            const em = mockEntityManager({
                query: [
                    [LIST_ORDERS, []],
                    [LIST_ORDERS, []],
                ],
            })
            const orders = await build(em)

            await orders.list("ws-1", 0)
            await orders.list("ws-1")

            expect(em.query.mock.calls).toEqual([
                [LIST_ORDERS, ["ws-1", 1]],
                [LIST_ORDERS, ["ws-1", 200]],
            ])
        })
    })

    describe("listForWorkbench", () => {
        it("reads the workbench orders with a clamped limit", async () => {
            const row: OrdersWorkbenchRow = orderOf({ status: "confirmed" })
            const em = mockEntityManager({
                query: [
                    [LIST_WORKBENCH_ORDERS, [row]],
                    [LIST_WORKBENCH_ORDERS, []],
                ],
            })
            const orders = await build(em)

            await expect(orders.listForWorkbench("ws-1")).resolves.toEqual([row])
            await expect(orders.listForWorkbench("ws-1", -3)).resolves.toEqual([])
            expect(em.query.mock.calls).toEqual([
                [LIST_WORKBENCH_ORDERS, ["ws-1", 200]],
                [LIST_WORKBENCH_ORDERS, ["ws-1", 1]],
            ])
        })
    })

    describe("listForLead", () => {
        it("reads the orders of one customer", async () => {
            const em = mockEntityManager({ query: [LIST_LEAD_ORDERS, [orderOf()]] })
            const orders = await build(em)

            await expect(orders.listForLead("ws-1", "lead-1")).resolves.toEqual([orderOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_LEAD_ORDERS, ["ws-1", "lead-1"])
        })
    })

    describe("ship", () => {
        it("records the shipment at the clock instant on the manager it is given", async () => {
            const shipped = orderOf({ status: "confirmed", shipped_at: NOW, carrier: "GHN", tracking_code: "T1" })
            const own = mockEntityManager()
            const tx = mockEntityManager({ query: [SHIP_ORDER, [shipped]] })
            const orders = await build(own)

            await expect(orders.ship("ws-1", "order-1", "GHN", "T1", tx)).resolves.toEqual(shipped)
            expect(tx.query).toHaveBeenCalledWith(SHIP_ORDER, ["ws-1", "order-1", "GHN", "T1", NOW])
            expect(own.query).not.toHaveBeenCalled()
        })

        it("answers null when the order cannot be shipped", async () => {
            const orders = await build(mockEntityManager({ query: [SHIP_ORDER, []] }))

            await expect(orders.ship("ws-1", "order-1", "GHN", "T1")).resolves.toBeNull()
        })
    })

    describe("labelsOf", () => {
        it("reads nothing for no orders", async () => {
            const em = mockEntityManager()
            const orders = await build(em)

            await expect(orders.labelsOf("ws-1", [])).resolves.toEqual([])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("reads the number and items of the given orders", async () => {
            const label = { id: "order-1", order_no: "DH-20261013-0001", items: "2 x Tea" }
            const em = mockEntityManager({ query: [FIND_ORDER_LABELS, [label]] })
            const orders = await build(em)

            await expect(orders.labelsOf("ws-1", ["order-1"])).resolves.toEqual([label])
            expect(em.query).toHaveBeenCalledWith(FIND_ORDER_LABELS, ["ws-1", ["order-1"]])
        })
    })

    describe("draft", () => {
        it("numbers the order after the ones already taken today in shop time", async () => {
            const drafted = orderOf({ order_no: "DH-20261013-0004" })
            const em = mockEntityManager({
                query: [
                    [COUNT_ORDERS_WITH_PREFIX, [{ n: 3 }]],
                    [INSERT_ORDER_DRAFT, [drafted]],
                ],
            })
            const orders = await build(em)

            await expect(orders.draft(draftOf())).resolves.toEqual(drafted)
            expect(em.query.mock.calls).toEqual([
                [COUNT_ORDERS_WITH_PREFIX, ["ws-1", "DH-20261013-"]],
                [INSERT_ORDER_DRAFT, ["ws-1", "lead-1", "event-1", "DH-20261013-0004", "2 x Tea", 90000, "live"]],
            ])
        })

        it("starts the day at the first number when no count comes back", async () => {
            const em = mockEntityManager({
                query: [
                    [COUNT_ORDERS_WITH_PREFIX, []],
                    [INSERT_ORDER_DRAFT, [orderOf()]],
                ],
            })
            const orders = await build(em)

            await orders.draft(draftOf())

            expect(em.query).toHaveBeenLastCalledWith(INSERT_ORDER_DRAFT, [
                "ws-1",
                "lead-1",
                "event-1",
                "DH-20261013-0001",
                "2 x Tea",
                90000,
                "live",
            ])
        })

        it("keeps the channel number and suffixes it when it is taken", async () => {
            const drafted = orderOf({ order_no: "SHOP-77-11" })
            const em = mockEntityManager({
                query: [
                    [INSERT_ORDER_DRAFT, []],
                    [INSERT_ORDER_DRAFT, [drafted]],
                ],
            })
            const orders = await build(em)

            await expect(orders.draft(draftOf({ orderNo: "SHOP-77" }))).resolves.toEqual(drafted)
            expect(em.query.mock.calls).toEqual([
                [INSERT_ORDER_DRAFT, ["ws-1", "lead-1", "event-1", "SHOP-77", "2 x Tea", 90000, "live"]],
                [INSERT_ORDER_DRAFT, ["ws-1", "lead-1", "event-1", "SHOP-77-11", "2 x Tea", 90000, "live"]],
            ])
        })

        it("gives up after five taken numbers", async () => {
            const em = mockEntityManager({
                query: [
                    [INSERT_ORDER_DRAFT, []],
                    [INSERT_ORDER_DRAFT, []],
                    [INSERT_ORDER_DRAFT, []],
                    [INSERT_ORDER_DRAFT, []],
                    [INSERT_ORDER_DRAFT, []],
                ],
            })
            const orders = await build(em)

            await expect(orders.draft(draftOf({ orderNo: "SHOP-77" }))).rejects.toMatchObject({
                code: OrdersErrorCode.NotNumbered,
            })
            expect(em.query).toHaveBeenCalledTimes(5)
        })
    })

    describe("confirm", () => {
        it("confirms the draft at the clock instant", async () => {
            const confirmed = orderOf({ status: "confirmed", confirmed_by: "Lan", confirmed_at: NOW })
            const em = mockEntityManager({ query: [CONFIRM_ORDER, [confirmed]] })
            const orders = await build(em)

            await expect(
                orders.confirm({
                    workspaceId: "ws-1",
                    orderId: "order-1",
                    amountVnd: 90000,
                    items: "2 x Tea",
                    confirmedBy: "Lan",
                }),
            ).resolves.toEqual(confirmed)
            expect(em.query).toHaveBeenCalledWith(CONFIRM_ORDER, ["ws-1", "order-1", 90000, "2 x Tea", "Lan", NOW])
        })

        it("answers null for an order that is no longer a draft", async () => {
            const orders = await build(mockEntityManager({ query: [CONFIRM_ORDER, []] }))

            await expect(
                orders.confirm({
                    workspaceId: "ws-1",
                    orderId: "order-1",
                    amountVnd: null,
                    items: "2 x Tea",
                    confirmedBy: "Lan",
                }),
            ).resolves.toBeNull()
        })
    })

    describe("cancel", () => {
        it("answers the cancelled draft, or null once it is gone", async () => {
            const cancelled = orderOf({ status: "cancelled" })
            const em = mockEntityManager({
                query: [
                    [CANCEL_ORDER, [cancelled]],
                    [CANCEL_ORDER, []],
                ],
            })
            const orders = await build(em)

            await expect(orders.cancel("ws-1", "order-1")).resolves.toEqual(cancelled)
            await expect(orders.cancel("ws-1", "order-1")).resolves.toBeNull()
        })
    })

    describe("markInvoiced and markPaid", () => {
        it("moves the order to invoiced and then paid", async () => {
            const em = mockEntityManager({
                query: [
                    [SET_ORDER_STATUS, []],
                    [SET_ORDER_STATUS, []],
                ],
            })
            const orders = await build(em)

            await orders.markInvoiced("ws-1", "order-1")
            await orders.markPaid("ws-1", "order-1")

            expect(em.query.mock.calls).toEqual([
                [SET_ORDER_STATUS, ["ws-1", "order-1", "invoiced"]],
                [SET_ORDER_STATUS, ["ws-1", "order-1", "paid"]],
            ])
        })
    })
})

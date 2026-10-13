import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OrdersErrorCode } from "./errors/orders.error"
import type { NewOrderDraft, OrderConfirmation } from "./orders.contracts"
import { OrdersService } from "./orders.service"
import type { SalesOrderRow } from "./persistence/orders.rows"
import {
    CANCEL_ORDER,
    CONFIRM_ORDER,
    COUNT_ORDERS_WITH_PREFIX,
    FIND_ORDER,
    INSERT_ORDER_DRAFT,
    LIST_ORDERS,
    SHIP_ORDER,
} from "./persistence/orders.sql"

const NOW = "2026-10-13T03:00:00.000Z"

const ORDER: SalesOrderRow = {
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "EXT-1",
    items: "tea",
    amount_vnd: 1000,
    status: "draft",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: NOW,
    shipped_at: null,
    carrier: null,
    tracking_code: null,
}

const DRAFT: NewOrderDraft = {
    workspaceId: "ws-1",
    leadId: "lead-1",
    inboundEventId: null,
    orderNo: "EXT-1",
    items: "tea",
    amountVnd: 1000,
    origin: "live",
}

const CONFIRM: OrderConfirmation = {
    workspaceId: "ws-1",
    orderId: "order-1",
    amountVnd: 1000,
    items: "tea",
    confirmedBy: "An",
}

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
    it("returns the workspace order or null", async () => {
        const entityManager = mockEntityManager({
            query: [
                [FIND_ORDER, [ORDER]],
                [FIND_ORDER, []],
            ],
        })
        const orders = await build(entityManager)

        await expect(orders.find("ws-1", "order-1")).resolves.toEqual(ORDER)
        await expect(orders.find("ws-1", "missing")).resolves.toBeNull()
    })

    it("lists at most 500 orders", async () => {
        const entityManager = mockEntityManager({ query: [LIST_ORDERS, [ORDER]] })
        const orders = await build(entityManager)

        await expect(orders.list("ws-1", 900)).resolves.toEqual([ORDER])
        expect(entityManager.query).toHaveBeenCalledWith(LIST_ORDERS, ["ws-1", 500])
    })

    it("stores a draft under the number the channel gave", async () => {
        const entityManager = mockEntityManager({ query: [INSERT_ORDER_DRAFT, [ORDER]] })
        const orders = await build(entityManager)

        await expect(orders.draft(DRAFT)).resolves.toEqual(ORDER)
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_ORDER_DRAFT, [
            "ws-1",
            "lead-1",
            null,
            "EXT-1",
            "tea",
            1000,
            "live",
        ])
    })

    it("numbers a draft from the day's count when the channel gave none", async () => {
        const numbered = { ...ORDER, order_no: "DH-20261013-0003" }
        const entityManager = mockEntityManager({
            query: [
                [COUNT_ORDERS_WITH_PREFIX, [{ n: 2 }]],
                [INSERT_ORDER_DRAFT, [numbered]],
            ],
        })
        const orders = await build(entityManager)

        await expect(orders.draft({ ...DRAFT, orderNo: null })).resolves.toEqual(numbered)
    })

    it("confirms a draft and answers null when it is no longer a draft", async () => {
        const confirmed = { ...ORDER, status: "confirmed", confirmed_by: "An", confirmed_at: NOW }
        const entityManager = mockEntityManager({
            query: [
                [CONFIRM_ORDER, [confirmed]],
                [CONFIRM_ORDER, []],
            ],
        })
        const orders = await build(entityManager)

        await expect(orders.confirm(CONFIRM)).resolves.toEqual(confirmed)
        await expect(orders.confirm(CONFIRM)).resolves.toBeNull()
    })

    it("cancels a draft or answers null", async () => {
        const entityManager = mockEntityManager({
            query: [
                [CANCEL_ORDER, [{ ...ORDER, status: "cancelled" }]],
                [CANCEL_ORDER, []],
            ],
        })
        const orders = await build(entityManager)

        await expect(orders.cancel("ws-1", "order-1")).resolves.toEqual({ ...ORDER, status: "cancelled" })
        await expect(orders.cancel("ws-1", "order-1")).resolves.toBeNull()
    })

    it("records a shipment once", async () => {
        const shipped = { ...ORDER, status: "confirmed", shipped_at: NOW, carrier: "GHN", tracking_code: "T-1" }
        const entityManager = mockEntityManager({ query: [SHIP_ORDER, [shipped]] })
        const orders = await build(entityManager)

        await expect(orders.ship("ws-1", "order-1", "GHN", "T-1")).resolves.toEqual(shipped)
        expect(entityManager.query).toHaveBeenCalledWith(SHIP_ORDER, ["ws-1", "order-1", "GHN", "T-1", NOW])
    })

    it("gives up numbering after the attempt budget", async () => {
        const entityManager = mockEntityManager({ query: [INSERT_ORDER_DRAFT, []] })
        const orders = await build(entityManager)

        await expect(orders.draft(DRAFT)).rejects.toMatchObject({ code: OrdersErrorCode.NotNumbered })
    })
})

import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { EvidenceService } from "@modules/domain/decisions"
import { OrdersErrorCode, OrdersService } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OrderShippedEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { BaseEvent } from "@modules/platform/event-bus"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { SalesShipmentsService } from "./sales-shipments.service"
import type { SalesShipmentRequest } from "./sales.contracts"

const SHIPPED_AT = "2026-10-13T03:00:00.000Z"

type ShippedOrder = NonNullable<Awaited<ReturnType<OrdersService["ship"]>>>

const shippedOf = builder<ShippedOrder>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-20261013-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "confirmed",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-13T01:30:00.000Z",
    created_at: "2026-10-13T01:00:00.000Z",
    shipped_at: SHIPPED_AT,
    carrier: "GHN",
    tracking_code: "T1",
})

const requestOf = builder<SalesShipmentRequest>({
    workspaceId: "ws-1",
    locale: "en",
    orderId: "order-1",
    carrier: " GHN ",
    trackingCode: " T1 ",
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const bus = recordingEventBus<BaseEvent>()
    const catalog = mock<MessageCatalog>({
        get: jest.fn(
            (key: string, params: Readonly<Record<string, string | number>>) => `${key}${JSON.stringify(params)}`,
        ),
    })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "staff",
        staffId: "staff-1",
        displayName: "Lan",
        status: "active",
    })
    const orders = mock<OrdersService>()
    orders.ship.mockResolvedValue(shippedOf())
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesShipmentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: EVENT_BUS, useValue: bus },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OrdersService, useValue: orders },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { shipments: moduleRef.get(SalesShipmentsService), tx, bus, orders, evidence }
}

describe("SalesShipmentsService > markShipped", () => {
    it("ships the order, logs the evidence and publishes order_shipped in one transaction", async () => {
        const { shipments, tx, bus, orders, evidence } = await build()

        await expect(shipments.markShipped("user-1", requestOf())).resolves.toEqual({
            id: "order-1",
            orderNo: "DH-20261013-0001",
            notificationId: "order-1",
        })

        expect(tx.commits).toBe(1)
        expect(orders.ship.mock.calls[0]?.slice(0, 4)).toEqual(["ws-1", "order-1", "GHN", "T1"])
        expect(evidence.log.mock.calls[0]?.slice(0, 2)).toEqual([
            { workspaceId: "ws-1", actor: "Lan", locale: "en" },
            {
                lead_id: "lead-1",
                kind: "order.shipped",
                actor: "Lan",
                summary: 'sales.shipped{"who":"Lan","no":"DH-20261013-0001","carrier":"GHN"}',
                evidence: "T1",
            },
        ])
        expect(bus.writes.map((event) => [event.constructor, event.payload])).toEqual([
            [
                OrderShippedEvent,
                {
                    dedupeKey: "order-1",
                    workspaceId: "ws-1",
                    userId: "user-1",
                    orderId: "order-1",
                    orderNo: "DH-20261013-0001",
                    leadId: "lead-1",
                    carrier: "GHN",
                    trackingCode: "T1",
                    shippedAt: SHIPPED_AT,
                },
            ],
        ])
        expect(bus.allInTransaction).toBe(true)
    })
})

describe("SalesShipmentsService > markShipped failure", () => {
    it("rolls the shipment back when the fact cannot be sent", async () => {
        const failure = new Error("bus down")
        const { shipments, tx, bus } = await build()
        bus.failNext("publish", failure)

        await expect(shipments.markShipped("user-1", requestOf())).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
    })

    it.each([
        ["an empty carrier", { carrier: "  " }],
        ["an empty tracking code", { trackingCode: "" }],
        ["an overlong carrier", { carrier: "c".repeat(81) }],
        ["an overlong tracking code", { trackingCode: "t".repeat(81) }],
    ])("refuses %s before opening a transaction", async (_name, overrides) => {
        const { shipments, tx, orders } = await build()

        await expect(shipments.markShipped("user-1", requestOf(overrides))).rejects.toMatchObject({
            code: OrdersErrorCode.ShipmentInvalid,
        })
        expect(tx.outcomes).toEqual([])
        expect(orders.ship).not.toHaveBeenCalled()
    })

    it.each([
        ["missing or already shipped", null],
        ["not stamped as shipped", shippedOf({ shipped_at: null })],
    ])("rolls back when the order is %s", async (_name, order) => {
        const { shipments, tx, bus, orders, evidence } = await build()
        orders.ship.mockResolvedValue(order)

        await expect(shipments.markShipped("user-1", requestOf())).rejects.toMatchObject({
            code: OrdersErrorCode.NotShippable,
        })
        expect(tx.outcomes).toEqual(["rollback"])
        expect(bus.writes).toEqual([])
        expect(evidence.log).not.toHaveBeenCalled()
    })
})

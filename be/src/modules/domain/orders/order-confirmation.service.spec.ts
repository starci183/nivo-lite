import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { leadOf, orderOf } from "@tests/fixtures/builders/confirm-order-performer.builder"
import { LeadRecordsService } from "@modules/domain/leads"
import { DealWonEvent, OrderConfirmedEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { OrderConfirmationService } from "./order-confirmation.service"
import type { OrderConfirmationInput } from "./order-confirmation.service"
import { OrdersService } from "./orders.service"

const INPUT: OrderConfirmationInput = {
    workspaceId: "ws-1",
    orderId: "ord-1",
    amountVnd: 300000,
    items: "2 tea boxes",
    confirmedBy: "Lan",
    customer: "Walk-in",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const orders = mock<OrdersService>()
    const leads = mock<LeadRecordsService>()
    const bus = recordingEventBus()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderConfirmationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: OrdersService, useValue: orders },
            { provide: LeadRecordsService, useValue: leads },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { service: moduleRef.get(OrderConfirmationService), tx, orders, leads, bus }
}

describe("OrderConfirmationService", () => {
    it("confirms the draft, marks the deal won and publishes both events in the same transaction", async () => {
        const { service, tx, orders, leads, bus } = await build()
        orders.confirm.mockResolvedValue(orderOf({ status: "confirmed" }))
        leads.find.mockResolvedValue(leadOf())

        const confirmed = await service.confirm(INPUT)

        expect(confirmed).toMatchObject({ id: "ord-1", status: "confirmed" })
        expect(orders.confirm).toHaveBeenCalledWith(
            { workspaceId: "ws-1", orderId: "ord-1", amountVnd: 300000, items: "2 tea boxes", confirmedBy: "Lan" },
            expect.anything(),
        )
        expect(leads.markWon).toHaveBeenCalledWith("ws-1", "lead-1", expect.anything())
        expect(bus.eventsOf(OrderConfirmedEvent)).toHaveLength(1)
        expect(bus.eventsOf(DealWonEvent)).toHaveLength(1)
        expect(bus.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("names the buyer from the lead record, and falls back to the given customer without a record", async () => {
        const known = await build()
        known.orders.confirm.mockResolvedValue(orderOf())
        known.leads.find.mockResolvedValue(leadOf({ contact_name: "Minh" }))
        const unknown = await build()
        unknown.orders.confirm.mockResolvedValue(orderOf())
        unknown.leads.find.mockResolvedValue(null)

        await known.service.confirm(INPUT)
        await unknown.service.confirm(INPUT)

        expect(known.bus.eventsOf(OrderConfirmedEvent)[0]).toMatchObject({ payload: { customer: "Minh" } })
        expect(unknown.bus.eventsOf(OrderConfirmedEvent)[0]).toMatchObject({ payload: { customer: "Walk-in" } })
    })

    it("publishes only order_confirmed for an order with no customer, and marks no deal won", async () => {
        const { service, orders, leads, bus } = await build()
        orders.confirm.mockResolvedValue(orderOf({ lead_id: null }))

        await service.confirm(INPUT)

        expect(leads.markWon).not.toHaveBeenCalled()
        expect(bus.eventsOf(OrderConfirmedEvent)).toHaveLength(1)
        expect(bus.eventsOf(DealWonEvent)).toHaveLength(0)
    })

    it("changes nothing and publishes nothing when the order is no longer a draft", async () => {
        const { service, leads, orders, bus } = await build()
        orders.confirm.mockResolvedValue(null)

        await expect(service.confirm(INPUT)).resolves.toBeNull()

        expect(leads.markWon).not.toHaveBeenCalled()
        expect(bus.writes).toHaveLength(0)
    })

    it("runs the caller's work inside the transaction before the events go out", async () => {
        const { service, orders, leads, bus } = await build()
        orders.confirm.mockResolvedValue(orderOf())
        leads.find.mockResolvedValue(leadOf())
        const within = jest.fn(() => {
            expect(bus.writes).toHaveLength(0)
            return Promise.resolve()
        })

        await service.confirm(INPUT, within)

        expect(within).toHaveBeenCalledWith(expect.objectContaining({ id: "ord-1" }), expect.anything())
        expect(bus.writes).toHaveLength(2)
    })
})

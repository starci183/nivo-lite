import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CONFIRM_ORDER_AMOUNT, ORDER_AMOUNT, OrderFactReaderService } from "./order-fact-reader.service"
import { OrdersService } from "./orders.service"

const SUBJECT = { type: "order", id: "order-1", workItemId: "item-1" }

const build = async (order: { amount_vnd: number | null } | null = { amount_vnd: 120_000 }) => {
    const orders = mock<OrdersService>({ find: jest.fn().mockResolvedValue(order) })
    const moduleRef = await Test.createTestingModule({
        providers: [OrderFactReaderService, { provide: OrdersService, useValue: orders }],
    }).compile()
    return { reader: moduleRef.get(OrderFactReaderService), orders }
}

describe("OrderFactReaderService.facts", () => {
    it("declares the amount of an order and of its confirmation, counted in dong", async () => {
        const { reader } = await build()

        expect(reader.facts).toEqual([
            { key: "order.amount_vnd", type: "number", unit: "vnd", labelKey: "agentGraphs.fact.order.amount_vnd" },
            {
                key: "confirm_order.amount_vnd",
                type: "number",
                unit: "vnd",
                labelKey: "agentGraphs.fact.confirm_order.amount_vnd",
            },
        ])
    })
})

describe("OrderFactReaderService.read", () => {
    it("reads the amount from the order record for every fact asked, never from the proposal", async () => {
        const { reader, orders } = await build()

        await expect(
            reader.read("ws-1", { ...SUBJECT, amountVnd: 5 }, [ORDER_AMOUNT, CONFIRM_ORDER_AMOUNT]),
        ).resolves.toEqual({ [ORDER_AMOUNT]: 120_000, [CONFIRM_ORDER_AMOUNT]: 120_000 })
        expect(orders.find).toHaveBeenCalledWith("ws-1", "order-1")
    })

    it("reads an amount of nothing as 0, which is a figure on the record", async () => {
        const { reader } = await build({ amount_vnd: 0 })

        await expect(reader.read("ws-1", SUBJECT, [ORDER_AMOUNT])).resolves.toEqual({ [ORDER_AMOUNT]: 0 })
    })

    it("leaves the fact out when the order is gone or the record holds no amount, so the branch takes its else", async () => {
        const gone = await build(null)
        const blank = await build({ amount_vnd: null })

        await expect(gone.reader.read("ws-1", SUBJECT, [ORDER_AMOUNT])).resolves.toEqual({})
        await expect(blank.reader.read("ws-1", SUBJECT, [ORDER_AMOUNT])).resolves.toEqual({})
    })

    it("reads nothing about a subject that is not an order, or an order with no id, and does not look it up", async () => {
        const { reader, orders } = await build()

        await expect(reader.read("ws-1", { ...SUBJECT, type: "lead" }, [ORDER_AMOUNT])).resolves.toEqual({})
        await expect(reader.read("ws-1", { ...SUBJECT, id: "" }, [ORDER_AMOUNT])).resolves.toEqual({})
        expect(orders.find).not.toHaveBeenCalled()
    })
})

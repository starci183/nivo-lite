import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ORDER, orderOf } from "../../../rules/accounting/accounting.fixtures"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld, putOrder, putRecord } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { OPEN_ORDERS_SHOWN, openOrdersRead } from "./open-orders.read"

const run = (read: ReadDefinition, world: MemoryWorld): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), {}, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })

describe("the accounting.open-orders read", () => {
    it("lists the orders that wait for money, and no other", async () => {
        const world = memoryWorld()
        putOrder(world, ORDER)
        putOrder(world, orderOf({ id: "00000000-0000-4000-8000-0000000000b8", status: "invoiced", orderNo: "DH-8" }))
        putOrder(world, orderOf({ id: "00000000-0000-4000-8000-0000000000b9", status: "paid" }))
        putOrder(world, orderOf({ id: "00000000-0000-4000-8000-0000000000ba", status: "cancelled" }))
        const result = await run(openOrdersRead, world)
        expect(result.ok && result.data).toMatchObject({
            rows: [{ id: "00000000-0000-4000-8000-0000000000b8" }, { id: ORDER.id }],
        })
    })

    it("leaves out a row whose fields are not those of an order", async () => {
        const world = memoryWorld()
        putRecord(world, "sales.order", "00000000-0000-4000-8000-0000000000bb", { status: "confirmed", orderNo: 7 })
        putOrder(world, ORDER)
        const result = await run(openOrdersRead, world)
        expect(result.ok && result.data).toMatchObject({ rows: [{ id: ORDER.id }] })
    })

    it("has no row when nothing waits", async () => {
        await expect(run(openOrdersRead, memoryWorld())).resolves.toMatchObject({ ok: true, data: { rows: [] } })
    })

    it("shows at most fifty and is read with the view permission", () => {
        expect(OPEN_ORDERS_SHOWN).toBe(50)
        expect(openOrdersRead.permission).toBe("accounting.view")
    })
})

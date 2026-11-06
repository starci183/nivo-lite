import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { salesContextOf } from "../fixtures/sales.context"
import { sampleState, SAMPLE_NOW } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { orderRead } from "../reads/order.read"
import { cancelOrderAction } from "./cancel-order.action"

const CONTEXT = salesContextOf("staff-1")

const cancel = async (state: MemoryState, id: string): Promise<ActionResult> =>
    (await cancelOrderAction.execute?.(memoryProvider(state), { id }, CONTEXT)) ?? {
        ok: false,
        reason: "failed",
        message: { key: "not_run" },
    }

/** The flags the order detail is drawn from, as the read gives them after the engine's rows changed. */
const flagsOf = async (state: MemoryState, id: string): Promise<unknown> => {
    const result = await orderRead.execute?.(memoryProvider(state), { id }, CONTEXT)
    return result?.ok === true ? result.data : null
}

const link = (id: string, orderId: string): MemoryState["transactions"][number] => ({
    id,
    orderId,
    status: "matched",
    version: "1",
    createdAt: SAMPLE_NOW,
    updatedAt: SAMPLE_NOW,
})

describe("cancelling a confirmed order, from the detail the owner sees to the order the engine holds", () => {
    it("offers the cancel on a confirmed unpaid order, cancels it, withdraws its waiting claim and offers nothing after", async () => {
        const state = sampleState([])
        state.claims.push({ ...link("claim-1", "order-3"), status: "open" })
        expect(await flagsOf(state, "order-3")).toMatchObject({
            status: "confirmed",
            canConfirm: false,
            canCancel: true,
        })
        expect(await cancel(state, "order-3")).toEqual({ ok: true })
        expect(await flagsOf(state, "order-3")).toMatchObject({
            status: "cancelled",
            canConfirm: false,
            canCancel: false,
        })
        expect(state.claims[0]?.status).toBe("withdrawn")
    })

    it("offers no cancel on an order a payment is allocated to, and refuses it when asked anyway", async () => {
        const state = sampleState([])
        state.transactions.push(link("tx-1", "order-3"))
        expect(await flagsOf(state, "order-3")).toMatchObject({ canCancel: false })
        expect(await cancel(state, "order-3")).toMatchObject({ message: { key: "refusal_order_has_payment" } })
        expect(await flagsOf(state, "order-3")).toMatchObject({ status: "confirmed" })
    })

    it("refuses a paid order and keeps it paid", async () => {
        const state = sampleState([])
        expect(await cancel(state, "order-4")).toMatchObject({ message: { key: "refusal_order_paid" } })
        expect(await flagsOf(state, "order-4")).toMatchObject({ status: "paid", canCancel: false })
    })
})

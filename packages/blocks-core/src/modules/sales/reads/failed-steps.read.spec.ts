import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ORDER_WAITING, SAMPLE_NOW, sampleState } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import { failedStepsRead } from "./failed-steps.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date(SAMPLE_NOW) }

describe("sales.failed-steps", () => {
    it("lists the orders whose step failed, newest first, with the customer's name", async () => {
        const state = sampleState([])
        state.orders.push({
            ...ORDER_WAITING,
            id: "order-8",
            orderNo: "DH-X",
            leadId: null,
            status: "failed_system",
            createdAt: "2026-11-05T01:00:00.000Z",
        })
        const result = await failedStepsRead.execute?.(memoryProvider(state), {}, CONTEXT)
        expect(result).toMatchObject({
            ok: true,
            data: {
                rows: [
                    { id: "order-8", title: "DH-X", reason: "failed_step" },
                    { id: "order-7", reason: "failed_step" },
                ],
                cursor: null,
            },
        })
    })

    it("names the order by its customer when the customer is known", async () => {
        const result = await failedStepsRead.execute?.(memoryProvider(sampleState([])), {}, CONTEXT)
        expect(JSON.stringify(result)).toContain("DH-20261104-0003 ")
    })

    it("is read with the view permission", () => {
        expect(failedStepsRead.permission).toBe("sales.view")
    })
})

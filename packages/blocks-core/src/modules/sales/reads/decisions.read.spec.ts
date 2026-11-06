import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { SAMPLE_NOW, sampleState } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import { decisionsRead } from "./decisions.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date(SAMPLE_NOW) }

const dataOf = async (state = sampleState([])): Promise<unknown> => {
    const result = await decisionsRead.execute?.(memoryProvider(state), {}, CONTEXT)
    return result?.ok === true ? result.data : result
}

describe("sales.decisions", () => {
    it("draws the waiting order as a decision with approve and reject", async () => {
        expect(await dataOf()).toMatchObject({
            count: "1",
            rows: [{ id: "order-1", amount: "6,000,000 VND", primary: { id: "approve" }, menu: [{ id: "reject" }] }],
        })
    })

    it("is empty when no order waits", async () => {
        expect(await dataOf({ ...sampleState([]), orders: [] })).toEqual({ count: null, more: null, rows: [] })
    })
})

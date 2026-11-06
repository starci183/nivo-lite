import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { SAMPLE_NOW, sampleState } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import { attentionRead } from "./attention.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date(SAMPLE_NOW) }

const dataOf = async (state = sampleState([])): Promise<unknown> => {
    const result = await attentionRead.execute?.(memoryProvider(state), {}, CONTEXT)
    return result?.ok === true ? result.data : result
}

describe("sales.attention", () => {
    it("lists the order that waits for the owner with the customer and why", async () => {
        expect(await dataOf()).toEqual({
            rows: [
                {
                    id: "order-1",
                    title: "DH-20261104-0001 · Ph\u1ea1m Qu\u1ed1c D\u0169ng",
                    description: "10 x h\u1ed9p qu\u00e0 · 6.000.000\u00a0₫",
                    reason: "owner",
                },
            ],
            cursor: null,
        })
    })

    it("lists nothing when no order waits", async () => {
        expect(await dataOf({ ...sampleState([]), orders: [] })).toEqual({ rows: [], cursor: null })
    })
})

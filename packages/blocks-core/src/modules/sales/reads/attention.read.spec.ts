import { sampleState } from "../fixtures/sales.data"
import { salesContextOf } from "../fixtures/sales.context"
import { memoryProvider } from "../memory"
import { attentionRead } from "./attention.read"

const CONTEXT = salesContextOf()

const dataOf = async (state = sampleState([])): Promise<unknown> => {
    const result = await attentionRead.execute?.(memoryProvider(state), {}, CONTEXT)
    return result?.ok === true ? result.data : result
}

describe("sales.attention", () => {
    it("lists the deal past its next step, the customer with a question and the order that waits for the owner", async () => {
        expect(await dataOf()).toEqual({
            rows: [
                {
                    id: "lead-3",
                    title: "L\u00ea Minh Ch\u00e2u",
                    description: "G\u1eedi b\u00e1o gi\u00e1",
                    reason: "overdue",
                    at: "2026-11-04T09:00:00.000Z",
                },
                {
                    id: "lead-2",
                    title: "Tr\u1ea7n Th\u1ecb B\u00ecnh",
                    description: "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i",
                    reason: "needs_reply",
                    at: "2026-11-04T08:00:00.000Z",
                },
                {
                    id: "order-1",
                    title: "DH-20261104-0001 \u00b7 Ph\u1ea1m Qu\u1ed1c D\u0169ng",
                    description: "10 x h\u1ed9p qu\u00e0 \u00b7 6.000.000\u00a0\u20ab",
                    reason: "owner",
                    at: "",
                },
            ],
            cursor: null,
        })
    })

    it("lists nothing when nothing is late, asked or waiting", async () => {
        const state = sampleState([])
        const quiet = {
            ...state,
            leads: state.leads.map((lead) => ({ ...lead, nextDueAt: null, needs: null })),
            orders: [],
        }
        expect(await dataOf(quiet)).toEqual({ rows: [], cursor: null })
    })

    it("leaves a closed deal out even when its next step is past its day", async () => {
        const state = sampleState([])
        const closed = {
            ...state,
            leads: state.leads.map((lead) => ({ ...lead, stage: "won" as const })),
            orders: [],
        }
        expect(await dataOf(closed)).toEqual({ rows: [], cursor: null })
    })
})

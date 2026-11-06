import { sampleState } from "../fixtures/sales.data"
import { salesContextOf } from "../fixtures/sales.context"
import { memoryProvider } from "../memory"
import { figuresRead } from "./figures.read"

const CONTEXT = salesContextOf()

const dataOf = async (state = sampleState([])): Promise<unknown> => {
    const result = await figuresRead.execute?.(memoryProvider(state), {}, CONTEXT)
    return result?.ok === true ? result.data : result
}

describe("sales.figures", () => {
    it("adds up the open customers, the draft value, the closed orders and the won share", async () => {
        expect(await dataOf()).toEqual({
            openCount: 4,
            proposalCount: 2,
            proposalValueVnd: 6_360_000,
            closedCount: 3,
            closedValueVnd: 6_100_000,
            conversion: 1,
            openHint: { key: "fig_open_hint" },
            proposalHint: { key: "fig_proposal_hint", values: { count: 2 } },
            closedHint: { key: "fig_closed_hint", values: { amount: 6 } },
            conversionHint: { key: "fig_conversion_hint" },
        })
    })

    it("is zero for a workspace with nothing", async () => {
        expect(await dataOf({ ...sampleState([]), leads: [], orders: [] })).toMatchObject({
            openCount: 0,
            conversion: 0,
        })
    })

    it("needs the view permission", () => {
        expect(figuresRead.permission).toBe("sales.view")
    })
})

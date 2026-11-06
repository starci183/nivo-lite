import { chatFiguresOf } from "./figures"

describe("chatFiguresOf", () => {
    it("adds the statuses and gives the share the AI answers", () => {
        expect(chatFiguresOf({ ai: 3, needs: 1, handled: 0 })).toEqual({
            total: 4,
            aiShare: 0.75,
            needsCount: 1,
            handledCount: 0,
        })
    })

    it("is zero for no conversation", () => {
        expect(chatFiguresOf({})).toEqual({ total: 0, aiShare: 0, needsCount: 0, handledCount: 0 })
    })
})

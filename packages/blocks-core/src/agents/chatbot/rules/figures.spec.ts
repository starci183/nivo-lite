import { chatFiguresOf } from "./figures"

// Design change (ruling R43): the staff hold is the engine's route hold, not a stored mark the inbox can count; R45: the held figure is the
// engine's count of held routes, handed in.
describe("chatFiguresOf", () => {
    it("adds the stored marks and gives the share the AI answers", () => {
        expect(chatFiguresOf({ ai: 3, needs: 1 }, 1)).toEqual({ total: 4, aiShare: 0.75, needsCount: 1, heldCount: 1 })
    })

    it("is zero for no conversation", () => {
        expect(chatFiguresOf({}, 0)).toEqual({ total: 0, aiShare: 0, needsCount: 0, heldCount: 0 })
    })
})

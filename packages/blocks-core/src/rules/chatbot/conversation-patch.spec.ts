import { marksOf, patchAfterWaiting } from "./conversation-patch"
import type { ConversationState } from "./conversation-patch"

// Design change (owner ruling R26, MESSAGES-PLAN section 4): the chat keeps no tail of the lines (no preview, last role or count) and no
// derived "unanswered": `unanswered` is the chatbot's own stored mark (set by hear on a person's line, cleared by a reply). The marks a
// change derives are the inbox status only.
// Design change (ruling R43): who holds the thread is the ENGINE's (the route's staff hold), so the chat stores no holder and no `handled`
// mark: the stored mark is the open question only (`needs` / `ai`); `handled` is shown from the route. `patchAfterHandling` is gone.
const FRESH: ConversationState = { waiting: false }

describe("marksOf", () => {
    it("derives the stored mark from the open question", () => {
        expect(marksOf(FRESH)).toEqual({ status: "ai" })
        expect(marksOf({ waiting: true })).toEqual({ status: "needs" })
    })
})

describe("patchAfterWaiting", () => {
    it("lists a conversation with a question for a person under needs", () => {
        expect(patchAfterWaiting(FRESH, true)).toEqual({ waiting: true, status: "needs" })
    })

    it("lists it as the AI's again once the question is answered (a hold is shown from the route)", () => {
        expect(patchAfterWaiting({ waiting: true }, false)).toEqual({ waiting: false, status: "ai" })
    })
})

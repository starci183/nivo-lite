import { marksOf, patchAfterHandling, patchAfterLine, patchAfterWaiting } from "./conversation-patch"
import type { ConversationState } from "./conversation-patch"
import { EMPTY_TAIL } from "./conversation-tail"

const FRESH: ConversationState = { ...EMPTY_TAIL, waiting: false, handledBy: null }

describe("marksOf", () => {
    it("derives the status and the unanswered mark from the state", () => {
        expect(marksOf({ ...FRESH, lastRole: "user", handledBy: "Ha" })).toEqual({
            status: "handled",
            unanswered: true,
        })
        expect(marksOf(FRESH)).toEqual({ status: "ai", unanswered: false })
    })
})

describe("patchAfterLine", () => {
    it("moves the tail and leaves the AI's conversation answered", () => {
        expect(patchAfterLine(FRESH, { role: "user", text: "Hi", at: "t1" })).toEqual({
            lastText: "Hi",
            lastRole: "user",
            lastAt: "t1",
            messageCount: 1,
            status: "ai",
            unanswered: false,
        })
    })

    it("marks a customer line unanswered while a person holds the conversation", () => {
        const patch = patchAfterLine({ ...FRESH, handledBy: "Ha" }, { role: "user", text: "Hello?", at: "t2" })
        expect(patch.status).toBe("handled")
        expect(patch.unanswered).toBe(true)
    })

    it("clears the unanswered mark when the person answers", () => {
        const waiting: ConversationState = { ...FRESH, lastRole: "user", waiting: true, handledBy: "Ha" }
        expect(patchAfterLine(waiting, { role: "agent", text: "Here", at: "t3" }).unanswered).toBe(false)
    })
})

describe("patchAfterHandling", () => {
    it("holds the conversation under the member's name", () => {
        expect(patchAfterHandling({ ...FRESH, lastRole: "user" }, "Ha")).toEqual({
            handledBy: "Ha",
            status: "handled",
            unanswered: true,
        })
    })

    it("hands it back to the AI", () => {
        expect(patchAfterHandling({ ...FRESH, handledBy: "Ha", lastRole: "user" }, null)).toEqual({
            handledBy: null,
            status: "ai",
            unanswered: false,
        })
    })
})

describe("patchAfterWaiting", () => {
    it("lists a conversation with a question for a person under needs", () => {
        expect(patchAfterWaiting({ ...FRESH, lastRole: "user" }, true)).toEqual({
            waiting: true,
            status: "needs",
            unanswered: true,
        })
    })

    it("lists it again by its holder once the question is answered", () => {
        expect(patchAfterWaiting({ ...FRESH, waiting: true, handledBy: "Ha" }, false)).toEqual({
            waiting: false,
            status: "handled",
            unanswered: false,
        })
    })
})

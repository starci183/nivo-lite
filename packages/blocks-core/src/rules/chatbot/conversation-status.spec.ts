import { INBOX_STATUSES, inboxStatusOf, unansweredOf } from "./conversation-status"

describe("inboxStatusOf", () => {
    it("lists a waiting customer first, even when a person holds the conversation", () => {
        expect(inboxStatusOf({ waiting: true, handledBy: null })).toBe("needs")
        expect(inboxStatusOf({ waiting: true, handledBy: "Ha" })).toBe("needs")
    })

    it("lists a held conversation as handled and the rest as the AI's", () => {
        expect(inboxStatusOf({ waiting: false, handledBy: "Ha" })).toBe("handled")
        expect(inboxStatusOf({ waiting: false, handledBy: null })).toBe("ai")
    })

    it("offers the three statuses in the inbox order", () => {
        expect(INBOX_STATUSES).toEqual(["needs", "handled", "ai"])
    })
})

describe("unansweredOf", () => {
    it("is true when the customer wrote last and a person is needed or holds the conversation", () => {
        expect(unansweredOf({ waiting: true, handledBy: null, lastRole: "user" })).toBe(true)
        expect(unansweredOf({ waiting: false, handledBy: "Ha", lastRole: "user" })).toBe(true)
    })

    it("is false when the AI answers, or the agent wrote last, or nobody spoke", () => {
        expect(unansweredOf({ waiting: false, handledBy: null, lastRole: "user" })).toBe(false)
        expect(unansweredOf({ waiting: true, handledBy: "Ha", lastRole: "agent" })).toBe(false)
        expect(unansweredOf({ waiting: true, handledBy: "Ha", lastRole: null })).toBe(false)
    })
})

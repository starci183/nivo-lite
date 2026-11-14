import { CHAT_MARKS, INBOX_STATUSES, chatMarkOf, inboxStatusOf } from "./conversation-status"

// Design change (owner ruling R26): `unansweredOf` is gone with the chat's line tail; `unanswered` is the chatbot's own stored mark.
// Design change (ruling R43): the holder is the engine's route hold, so the facts say `held` (from the route), not a stored name.
describe("inboxStatusOf", () => {
    it("lists a waiting customer first, even when a person holds the conversation", () => {
        expect(inboxStatusOf({ waiting: true, held: false })).toBe("needs")
        expect(inboxStatusOf({ waiting: true, held: true })).toBe("needs")
    })

    it("lists a held conversation as handled and the rest as the AI's", () => {
        expect(inboxStatusOf({ waiting: false, held: true })).toBe("handled")
        expect(inboxStatusOf({ waiting: false, held: false })).toBe("ai")
    })

    it("offers the three statuses in the inbox order", () => {
        expect(INBOX_STATUSES).toEqual(["needs", "handled", "ai"])
    })
})

describe("chatMarkOf", () => {
    it("stores only the open question: handled is never a stored mark", () => {
        expect(chatMarkOf(true)).toBe("needs")
        expect(chatMarkOf(false)).toBe("ai")
        expect(CHAT_MARKS).toEqual(["needs", "ai"])
    })
})

import { REPLY_MAX } from "../../rules/chatbot/reply"
import { DRAFT_PURPOSE, approvedKeyOf, draftAsk, draftKeyOf, draftTextOf } from "./draft.policy"

describe("draftAsk", () => {
    it("asks for a reply for the owner to approve, with the question and the grounded answer as data", () => {
        const request = draftAsk({ conversationId: "c1", question: "Open on the 2nd?", grounded: "Open 9 to 17." })

        expect(request.purpose).toBe(DRAFT_PURPOSE)
        expect(request.instructions).toContain("approve")
        expect(request.instructions).toContain("never promise")
        expect(request.input).toEqual({ question: "Open on the 2nd?", grounded: "Open 9 to 17." })
    })

    it("passes no grounded answer as null", () => {
        expect(draftAsk({ conversationId: "c1", question: "Hi", grounded: null }).input).toEqual({
            question: "Hi",
            grounded: null,
        })
    })
})

describe("draftTextOf", () => {
    it("takes what the model wrote, without the blanks around it", () => {
        expect(draftTextOf("  Yes, we are open.  ", "Open 9 to 17.")).toBe("Yes, we are open.")
    })

    it("falls back to the grounded answer when the model wrote nothing", () => {
        expect(draftTextOf("   ", " Open 9 to 17. ")).toBe("Open 9 to 17.")
    })

    it("stores nothing when neither has words", () => {
        expect(draftTextOf("", null)).toBeNull()
        expect(draftTextOf(" ", "  ")).toBeNull()
    })

    it("cuts the draft to the longest reply a person may send", () => {
        expect(draftTextOf("a".repeat(REPLY_MAX + 10), null)).toHaveLength(REPLY_MAX)
    })
})

describe("the keys", () => {
    it("make a draft once per turn and conversation, and an approved send once per stored line", () => {
        expect(draftKeyOf("t1", "c1")).toBe("draft:t1:c1")
        expect(draftKeyOf("t1", "c1")).not.toBe(draftKeyOf("t2", "c1"))
        expect(approvedKeyOf("m1")).toBe("approved:m1")
    })
})

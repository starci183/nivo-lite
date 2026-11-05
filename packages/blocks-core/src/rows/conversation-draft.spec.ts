import { DEFAULT_MAX_LENGTH, canSend, draftIssue, textToSend } from "./conversation-draft"

describe("textToSend", () => {
    it("drops the blanks around the words", () => {
        expect(textToSend("  hello \n")).toBe("hello")
    })
})

describe("draftIssue", () => {
    it("calls a draft of blanks empty", () => {
        expect(draftIssue("", 10)).toBe("empty")
        expect(draftIssue("   \n ", 10)).toBe("empty")
    })

    it("calls a draft over the limit too long, counting the words without the blanks around them", () => {
        expect(draftIssue("12345678901", 10)).toBe("tooLong")
        expect(draftIssue("  1234567890  ", 10)).toBeNull()
    })

    it("accepts a draft within the limit", () => {
        expect(draftIssue("hello", DEFAULT_MAX_LENGTH)).toBeNull()
    })
})

describe("canSend", () => {
    it("works for a fit draft with nothing in flight", () => {
        expect(canSend("hello", 10, false)).toBe(true)
    })

    it("stays off while a send is in flight", () => {
        expect(canSend("hello", 10, true)).toBe(false)
    })

    it("stays off for a draft that is empty or too long", () => {
        expect(canSend(" ", 10, false)).toBe(false)
        expect(canSend("12345678901", 10, false)).toBe(false)
    })
})

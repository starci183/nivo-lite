import { chatbotCopy, chatbotCopyKeys, chatbotText } from "./copy"

describe("the Chatbot catalogue", () => {
    it("holds the same keys in both languages", () => {
        expect(chatbotCopyKeys("en")).toEqual(chatbotCopyKeys("vi"))
    })

    it("words a key in each language", () => {
        expect(chatbotCopy("tab_inbox", "en")).toBe("Inbox")
        expect(chatbotCopy("tab_inbox", "vi")).not.toBe("Inbox")
    })

    it("hands a key to a spec as a key, not as words", () => {
        expect(chatbotText("tab_inbox")).toEqual({ key: "tab_inbox" })
    })

    it("keeps the name placeholder in both notice templates", () => {
        for (const locale of ["vi", "en"] as const) {
            expect(chatbotCopy("notice_taken_over", locale)).toContain("{name}")
            expect(chatbotCopy("notice_released", locale)).toContain("{name}")
        }
    })
})

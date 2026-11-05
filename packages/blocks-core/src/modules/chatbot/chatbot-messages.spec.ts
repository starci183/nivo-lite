import { CHATBOT_MESSAGES } from "./chatbot-messages"

describe("CHATBOT_MESSAGES", () => {
    it("holds the same keys in both languages", () => {
        expect(Object.keys(CHATBOT_MESSAGES.en).toSorted()).toEqual(Object.keys(CHATBOT_MESSAGES.vi).toSorted())
    })
})

import { TAG_TEXT_MAX, tagContextOf } from "./agent-tag.policy"

describe("tagContextOf", () => {
    it("keeps the words, the subject and the conversation, and who or what tagged", () => {
        expect(
            tagContextOf({
                workspaceId: "w",
                toAgentId: "a",
                text: "hi",
                subject: "s",
                conversationId: "c",
                fromAgentId: "f",
            }),
        ).toEqual({ text: "hi", subject: "s", conversationId: "c", fromAgentId: "f" })
        expect(tagContextOf({ workspaceId: "w", toAgentId: "a", text: "hi", source: "feed" })).toEqual({
            text: "hi",
            tagSource: "feed",
        })
        expect(tagContextOf({ workspaceId: "w", toAgentId: "a", text: "hi", personId: "p", subject: null })).toEqual({
            text: "hi",
        })
    })

    it("clips the words and the labels", () => {
        const context = tagContextOf({
            workspaceId: "w",
            toAgentId: "a",
            text: "x".repeat(TAG_TEXT_MAX + 50),
            subject: "y".repeat(500),
            source: "z".repeat(500),
        })

        expect(context.text).toHaveLength(TAG_TEXT_MAX)
        expect(context.subject).toHaveLength(200)
        expect(context.tagSource).toHaveLength(200)
    })
})

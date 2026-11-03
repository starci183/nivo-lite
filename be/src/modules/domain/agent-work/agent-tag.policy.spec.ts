import { TAG_CONTEXT_MAX, TAG_TEXT_MAX, tagContextOf, tagPayloadOf, tagPayloadTextOf } from "./agent-tag.policy"

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

describe("tag payload", () => {
    const base = { workspaceId: "w", toAgentId: "a", text: "hi", source: "feed" }

    it("keeps objects and arrays as JSON text and reads them back", () => {
        const text = tagPayloadTextOf({ ...base, context: { items: [{ sku: "x", qty: 2 }], address: "12 Le Loi" } })

        expect(text).toBe('{"items":[{"sku":"x","qty":2}],"address":"12 Le Loi"}')
        expect(tagPayloadOf(tagContextOf({ ...base }, text ?? undefined))).toEqual({
            items: [{ sku: "x", qty: 2 }],
            address: "12 Le Loi",
        })
    })

    it("has none when none was given, refuses one larger than a wake keeps, and reads a non-object as none", () => {
        expect(tagPayloadTextOf(base)).toBeUndefined()
        expect(tagPayloadTextOf({ ...base, context: { blob: "x".repeat(TAG_CONTEXT_MAX) } })).toBeNull()
        expect(tagPayloadOf({})).toEqual({})
        expect(tagPayloadOf({ tagContext: "[1,2]" })).toEqual({})
    })
})

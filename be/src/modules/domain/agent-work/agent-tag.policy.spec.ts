import { Test } from "@nestjs/testing"
import { TAG_CONTEXT_MAX, TAG_TEXT_MAX, tagContextOf, tagPayloadOf, tagPayloadTextOf } from "./agent-tag.policy"

const SUBJECT = Symbol("agent-tag.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { tagContextOf, tagPayloadOf, tagPayloadTextOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-tag.policy")>(SUBJECT)
}

describe("tagContextOf", () => {
    it("keeps the words, the subject and the conversation, and who or what tagged", async () => {
        const { tagContextOf } = await build()

        expect(
            tagContextOf({
                workspaceId: "w",
                toAgentId: "a",
                text: "hi",
                subject: "s",
                conversationId: "c",
                fromAgentId: "f",
            }),
        ).toEqual({ text: "hi", subject: "s", conversationId: "c", authorAgentId: "f", locale: "vi" })
        expect(tagContextOf({ workspaceId: "w", toAgentId: "a", text: "hi", source: "feed" })).toEqual({
            text: "hi",
            locale: "vi",
            tagSource: "feed",
        })
        expect(tagContextOf({ workspaceId: "w", toAgentId: "a", text: "hi", personId: "p", subject: null })).toEqual({
            text: "hi",
            locale: "vi",
        })
    })

    it("clips the words and the labels", async () => {
        const { tagContextOf } = await build()

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

describe("tag context names", () => {
    it("writes the names the graph trigger reads: channel, customer, language and the agent behind the tag", async () => {
        const { tagContextOf } = await build()

        expect(
            tagContextOf({
                workspaceId: "w",
                toAgentId: "a",
                text: "hi",
                fromAgentId: "f",
                channel: "zalo",
                leadId: "l1",
                locale: "en",
            }),
        ).toEqual({ text: "hi", channel: "zalo", leadId: "l1", locale: "en", authorAgentId: "f" })
    })
})

describe("tag payload", () => {
    const base = { workspaceId: "w", toAgentId: "a", text: "hi", source: "feed" }

    it("keeps objects and arrays as JSON text and reads them back", async () => {
        const { tagContextOf, tagPayloadOf, tagPayloadTextOf } = await build()

        const text = tagPayloadTextOf({ ...base, context: { items: [{ sku: "x", qty: 2 }], address: "12 Le Loi" } })

        expect(text).toBe('{"items":[{"sku":"x","qty":2}],"address":"12 Le Loi"}')
        expect(tagPayloadOf(tagContextOf({ ...base }, text ?? undefined))).toEqual({
            items: [{ sku: "x", qty: 2 }],
            address: "12 Le Loi",
        })
    })

    it("has none when none was given, refuses one larger than a wake keeps, and reads a non-object as none", async () => {
        const { tagPayloadOf, tagPayloadTextOf } = await build()

        expect(tagPayloadTextOf(base)).toBeUndefined()
        expect(tagPayloadTextOf({ ...base, context: { blob: "x".repeat(TAG_CONTEXT_MAX) } })).toBeNull()
        expect(tagPayloadOf({})).toEqual({})
        expect(tagPayloadOf({ tagContext: "[1,2]" })).toEqual({})
    })

    it("reads stored text that does not parse as none", async () => {
        const { tagPayloadOf } = await build()

        expect(tagPayloadOf({ tagContext: "{not json" })).toEqual({})
    })
})

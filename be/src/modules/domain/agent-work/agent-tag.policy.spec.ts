import { Test } from "@nestjs/testing"
import { TAG_TEXT_MAX, tagContextOf, tagPayloadOf } from "./agent-tag.policy"

const SUBJECT = Symbol("agent-tag.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { tagContextOf, tagPayloadOf } }],
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

    // Ledger (ROAD Opus-1d, 2026-11-14): the writer side (`tagPayloadTextOf`, the size cap) went with the tag door (ruling R34); the
    // read side of a tag wake's plain data stays.
    it("reads objects and arrays back from the JSON text a tag wake carries", async () => {
        const { tagContextOf, tagPayloadOf } = await build()

        const text = '{"items":[{"sku":"x","qty":2}],"address":"12 Le Loi"}'
        expect(tagPayloadOf(tagContextOf({ ...base }, text))).toEqual({
            items: [{ sku: "x", qty: 2 }],
            address: "12 Le Loi",
        })
    })

    it("has none when none was given and reads a non-object as none", async () => {
        const { tagPayloadOf } = await build()

        expect(tagPayloadOf({})).toEqual({})
        expect(tagPayloadOf({ tagContext: "[1,2]" })).toEqual({})
    })

    it("reads stored text that does not parse as none", async () => {
        const { tagPayloadOf } = await build()

        expect(tagPayloadOf({ tagContext: "{not json" })).toEqual({})
    })
})

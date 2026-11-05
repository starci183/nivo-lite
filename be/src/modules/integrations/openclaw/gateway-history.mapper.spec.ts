import { Test } from "@nestjs/testing"
import { HISTORY_LIMIT, HISTORY_METHOD, historyOf } from "./gateway-history.mapper"

/** The mapper as one provider, read through the Nest testing module. */
class Subject {
    readonly HISTORY_LIMIT = HISTORY_LIMIT
    readonly HISTORY_METHOD = HISTORY_METHOD
    readonly historyOf = historyOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [Subject] }).compile()
    return moduleRef.get(Subject)
}

const FALLBACK = new Date("2026-11-05T00:00:00.000Z")

describe("historyOf", () => {
    it("names the request and the bound of a history read", async () => {
        const subject = await build()
        expect(subject.HISTORY_METHOD).toBe("chat.history")
        expect(subject.HISTORY_LIMIT).toBe(1000)
    })

    it("reads each message as a turn at its position, with its text, tool calls and instant", async () => {
        const subject = await build()
        const turns = subject.historyOf(
            {
                messages: [
                    { role: "user", content: "xin chao", timestamp: 1_762_300_800_000 },
                    {
                        role: "assistant",
                        content: [
                            { type: "text", text: "ok" },
                            { type: "toolCall", name: "ledger.append", arguments: { id: 1 } },
                            { type: "tool_use", name: "zalo.status", input: { a: "b" } },
                            { type: "toolUse", name: "x" },
                        ],
                        timestamp: "2026-11-05T01:00:00.000Z",
                    },
                    { role: "toolResult", content: { text: "done" } },
                ],
            },
            FALLBACK,
        )
        expect(turns).toEqual([
            { index: 0, role: "user", text: "xin chao", toolCalls: [], at: "2025-11-05T00:00:00.000Z" },
            {
                index: 1,
                role: "assistant",
                text: "ok",
                toolCalls: [
                    { name: "ledger.append", argsJson: '{"id":1}' },
                    { name: "zalo.status", argsJson: '{"a":"b"}' },
                    { name: "x", argsJson: "{}" },
                ],
                at: "2026-11-05T01:00:00.000Z",
            },
            { index: 2, role: "tool", text: "done", toolCalls: [], at: FALLBACK.toISOString() },
        ])
    })

    it("leaves a gap for a message it does not keep and gives an empty text to one without text", async () => {
        const subject = await build()
        const turns = subject.historyOf(
            {
                messages: [
                    "x",
                    { role: 3 },
                    { role: "wizard", content: "?" },
                    { role: "system", timestamp: "not a date" },
                ],
            },
            FALLBACK,
        )
        expect(turns).toEqual([{ index: 3, role: "system", text: "", toolCalls: [], at: FALLBACK.toISOString() }])
    })
})

describe("historyOf positions", () => {
    it("starts a page that begins at sequence 41 at position 40, so a sliding window keeps each index", async () => {
        const subject = await build()
        const turns = subject.historyOf(
            {
                messages: [
                    { role: "user", content: "a", __openclaw: { seq: 41 } },
                    { role: "assistant", content: "b", __openclaw: { seq: 42 } },
                ],
            },
            FALLBACK,
        )
        expect(turns.map((turn) => turn.index)).toEqual([40, 41])
    })

    it("starts at 0 when the first message carries no usable sequence", async () => {
        const subject = await build()
        const starts = [
            { role: "user", content: "a" },
            { role: "user", content: "a", __openclaw: { id: "e1" } },
            { role: "user", content: "a", __openclaw: { seq: 0 } },
            { role: "user", content: "a", __openclaw: { seq: 1.5 } },
            { role: "user", content: "a", __openclaw: "x" },
        ]
        for (const first of starts) {
            expect(subject.historyOf({ messages: [first] }, FALLBACK).map((turn) => turn.index)).toEqual([0])
        }
    })
})

describe("historyOf tool calls and payloads", () => {
    it("ignores tool call parts that are malformed and bounds long ones", async () => {
        const subject = await build()
        const many = Array.from({ length: 60 }, (_, i) => ({ type: "toolCall", name: `t${i}` }))
        const [turn] = subject.historyOf(
            {
                messages: [
                    {
                        role: "assistant",
                        content: [
                            "text",
                            { type: "toolCall" },
                            { type: "image", name: "n" },
                            { type: "toolCall", name: "n".repeat(300), arguments: { v: "a".repeat(30_000) } },
                            ...many,
                        ],
                    },
                ],
            },
            FALLBACK,
        )
        expect(turn?.toolCalls).toHaveLength(50)
        expect(turn?.toolCalls[0]?.name).toHaveLength(200)
        expect(turn?.toolCalls[0]?.argsJson).toHaveLength(20_000)
    })

    it("answers no turns for a payload without messages", async () => {
        const subject = await build()
        expect(subject.historyOf(null, FALLBACK)).toEqual([])
        expect(subject.historyOf({ messages: "x" }, FALLBACK)).toEqual([])
        expect(subject.historyOf({}, FALLBACK)).toEqual([])
    })
})

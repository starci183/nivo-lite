import type { RunStop } from "@modules/domain/agent-threads/stops/run-stop.contracts"
import {
    alreadySentOf,
    founderDecisionsOf,
    ledgerLinesOf,
    stepPlaceOf,
    stopCounts,
    stopToldOf,
} from "./turn-policy.policy"

describe("stepPlaceOf", () => {
    it("reads the run and the step of a step key, and nothing of another key", () => {
        expect(stepPlaceOf("run-1:create-order")).toEqual({ runId: "run-1", stepKey: "create-order" })
        expect(stepPlaceOf("run-1:loop:item")).toEqual({ runId: "run-1", stepKey: "loop:item" })
        expect(stepPlaceOf("k")).toBeNull()
        expect(stepPlaceOf(":x")).toBeNull()
        expect(stepPlaceOf("run-1:")).toBeNull()
    })
})

describe("ledgerLinesOf", () => {
    it("keeps the words of the customer sends whose arguments were kept, oldest first, at the time they were kept", () => {
        const rows = [
            {
                data: { effectId: "nivo.tool.customer.message.send", args: { conversationId: "c-2", text: "B" } },
                createdAt: "2026-11-10T03:05:00.000Z",
            },
            {
                data: { effectId: "nivo.tool.customer.message.send", args: { leadId: "l-1", text: "A" } },
                createdAt: "2026-11-10T03:00:00.000Z",
            },
            {
                data: { effectId: "nivo.tool.team.message.post", args: { text: "team" } },
                createdAt: "2026-11-10T03:01:00.000Z",
            },
            {
                data: { effectId: "nivo.tool.customer.message.send", args: null },
                createdAt: "2026-11-10T03:02:00.000Z",
            },
            { data: { effectId: "nivo.tool.customer.message.send" }, createdAt: "2026-11-10T03:03:00.000Z" },
        ]
        expect(ledgerLinesOf(rows, ["nivo.tool.customer.message.send"])).toEqual([
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
        ])
    })
})

/** A stop as the stops' store answers it, with the members a case sets. */
const stopOf = (values: Partial<RunStop>): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: null,
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "R",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T03:00:00.000Z",
    resolvedAt: null,
    ...values,
})

describe("stopToldOf and stopCounts", () => {
    const NOW = new Date("2026-11-10T05:00:00.000Z")

    it("reads a stop's run, step, lines and resolution, and leaves out a line with no words or time", () => {
        expect(
            stopToldOf(
                stopOf({
                    runId: "run-1",
                    stepKey: "match",
                    customerLines: [
                        { conversationId: "c-1", text: "Da nhan", at: "2026-11-10T03:00:00.000Z" },
                        { conversationId: "c-1", text: "", at: "2026-11-10T03:00:00.000Z" },
                        { conversationId: "c-1", text: "no time", at: "" },
                    ],
                    resolvedAt: null,
                }),
            ),
        ).toEqual({
            runId: "run-1",
            stepKey: "match",
            lines: [{ text: "Da nhan", at: "2026-11-10T03:00:00.000Z" }],
            resolvedAt: null,
            decisions: [],
        })
        expect(stopToldOf(stopOf({ customerLines: [] })).lines).toEqual([])
    })

    it("counts an open stop always, a resolved one within the day only, and with no clock only an open one", () => {
        const open = { runId: "r", stepKey: "s", lines: [], resolvedAt: null, decisions: [] }
        const recent = { ...open, resolvedAt: "2026-11-09T06:00:00.000Z" }
        const old = { ...open, resolvedAt: "2026-11-09T04:59:59.000Z" }
        expect(stopCounts(open, NOW)).toBe(true)
        expect(stopCounts(recent, NOW)).toBe(true)
        expect(stopCounts(old, NOW)).toBe(false)
        expect(stopCounts(open, null)).toBe(true)
        expect(stopCounts(recent, null)).toBe(false)
    })
})

describe("founderDecisionsOf (D-MX-1)", () => {
    const stop = (runId: string, stepKey: string, answers: RunStop["answers"], question = "Q?") =>
        stopToldOf(stopOf({ runId, stepKey, question, reason: "R", customerLines: [], answers, resolvedAt: null }))

    it("reads the answers in words of other stops with the question they answer, oldest first, each once; never the own stop", () => {
        const stops = [
            stop("run-2", "answer", [
                { kind: "answer", text: "Co VAT 8%", by: "o", at: "2026-11-10T04:10:00.000Z" },
                { kind: "retry", text: null, by: "o", at: "2026-11-10T04:11:00.000Z" },
            ]),
            stop(
                "run-1",
                "consult",
                [{ kind: "answer", text: "Dong y doi", by: "o", at: "2026-11-10T03:00:00.000Z" }],
                "",
            ),
            stop("run-3", "match", [{ kind: "answer", text: "own", by: "o", at: "2026-11-10T05:00:00.000Z" }]),
        ]

        expect(founderDecisionsOf(stops, { runId: "run-3", stepKey: "match" })).toEqual([
            { question: "R", answer: "Dong y doi", at: "2026-11-10T03:00:00.000Z" },
            { question: "Q?", answer: "Co VAT 8%", at: "2026-11-10T04:10:00.000Z" },
        ])
    })
})

describe("alreadySentOf", () => {
    it("keeps each wording once at its first time, oldest first, the newest twenty only", () => {
        const lines = [
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "A", at: "2026-11-10T03:09:00.000Z" },
        ]
        expect(alreadySentOf(lines)).toEqual([
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
        ])
        const many = Array.from({ length: 25 }, (_, index) => ({
            text: `L${index}`,
            at: new Date(Date.UTC(2026, 10, 10, 0, index)).toISOString(),
        }))
        expect(alreadySentOf(many).map((line) => line.text)).toEqual(many.slice(5).map((line) => line.text))
    })
})

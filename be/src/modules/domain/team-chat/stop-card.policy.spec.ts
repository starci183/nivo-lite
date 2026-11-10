import {
    countedSectionOf,
    givenSectionOf,
    legacySectionOf,
    resolvedSectionOf,
    stopCardViewOf,
    stopIntentOf,
    stopReplyUsersOf,
    storedStopCardOf,
    typedPayloadOf,
} from "./stop-card.policy"
import type { StopCardSection, StopCardSectionGiven } from "./stop-card.contracts"

const AT = "2026-11-10T10:00:00.000Z"

const BASE = {
    workflow: { moduleKey: "sales", key: "consult", title: "Tư vấn bán hàng" },
    step: { key: "consult", nodeId: "sales.consult", title: "Tư vấn" },
    runId: "run-1",
    leadId: "lead-1",
    conversationId: "conv-1",
    by: "engine" as const,
    reason: "AI không trả lời sau 3 lần gọi. Khách chưa nhận được trả lời cho tin gần nhất.",
    question: null,
    facts: [{ name: "Lần gọi", value: "3" }],
    suggestions: [],
    decisions: ["retry" as const, "take_over" as const, "skip" as const],
    repeats: 1,
    firstAt: AT,
    lastAt: AT,
}

const GIVEN: StopCardSectionGiven = {
    version: 1,
    stopId: "stop-1",
    runId: "run-1",
    stepKey: "consult",
    kind: "ai_error",
    state: "open",
    headline: "Quy trình đang dừng: AI lỗi",
    needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
    replies: [],
    repeats: 1,
    stoppedAt: AT,
    resolvedAt: null,
}

const NOTHING = { answer: false, decisions: [], verdicts: [] }

const envelope = (payload: unknown, title = "Quy trình đang dừng"): string =>
    JSON.stringify({ kind: "workflow.stopped", intent: "ask", title, summary: "x", payload })

describe("the typed part of a stop card", () => {
    it("reads the part the engine handed under card.stop, and none when it is absent or wrong", () => {
        expect(givenSectionOf({ ...BASE, stop: GIVEN })).toEqual(GIVEN)
        expect(givenSectionOf(BASE)).toBeNull()
        expect(givenSectionOf({ ...BASE, stop: { ...GIVEN, state: "parked" } })).toBeNull()
        expect(givenSectionOf(null)).toBeNull()
    })

    it("counts every write: the first is 1, the next one more than the stored one", () => {
        const first = countedSectionOf(GIVEN, null)
        expect(first.revision).toBe(1)
        expect(countedSectionOf(GIVEN, first).revision).toBe(2)
    })

    it("keeps the suggestions and buttons only while asked, and follows the stop's resolution", () => {
        const open = countedSectionOf(GIVEN, null)
        const suggestions = [{ text: "Gọi khách", handledBy: "person" as const }]
        expect(typedPayloadOf({ ...BASE, suggestions }, open)).toMatchObject({
            decisions: ["retry", "take_over", "skip"],
            suggestions,
            stop: open,
        })
        expect(stopIntentOf(open)).toBe("ask")

        const skipped: StopCardSection = { ...open, state: "skipped", needs: NOTHING, resolvedAt: AT }
        expect(typedPayloadOf({ ...BASE, suggestions }, skipped)).toMatchObject({
            decisions: [],
            suggestions: [],
            resolvedAt: AT,
        })
        expect(stopIntentOf(skipped)).toBe("notify")
    })

    it("marks a stored part resolved on the old resolve path, a skipped one staying skipped", () => {
        const open = countedSectionOf(GIVEN, null)
        expect(resolvedSectionOf(open, AT)).toMatchObject({
            state: "resolved",
            resolvedAt: AT,
            needs: NOTHING,
            revision: 2,
        })
        expect(resolvedSectionOf({ ...open, state: "skipped" }, AT).state).toBe("skipped")
    })

    it("reads a card of the old engine as a typed stop: engine-worded is NIVO's report, open until resolved, its buttons kept", () => {
        expect(legacySectionOf(BASE, "Quy trình đang dừng")).toMatchObject({
            stopId: null,
            kind: "ai_error",
            state: "open",
            needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
            replies: [],
            revision: 0,
        })
        expect(legacySectionOf({ ...BASE, by: "ai", resolvedAt: AT }, "t")).toMatchObject({
            kind: "ai_report",
            state: "resolved",
            needs: NOTHING,
        })
    })
})

describe("a stored stop card as a screen shows it", () => {
    it("shows a typed card with its replies named, and none for a line that is no stop card", () => {
        const section = countedSectionOf(
            {
                ...GIVEN,
                state: "answered",
                needs: NOTHING,
                replies: [{ kind: "retry", text: null, by: "seat-1", at: AT }],
            },
            null,
        )
        const line = envelope(typedPayloadOf(BASE, section))
        expect(storedStopCardOf(line)?.section).toEqual(section)
        expect(stopReplyUsersOf(line)).toEqual(["seat-1"])
        expect(stopCardViewOf(line, (id) => (id === "seat-1" ? "Lan" : ""))).toMatchObject({
            kind: "ai_error",
            by: "engine",
            state: "answered",
            headline: "Quy trình đang dừng: AI lỗi",
            workflowTitle: "Tư vấn bán hàng",
            stepTitle: "Tư vấn",
            message: BASE.reason,
            facts: [{ name: "Lần gọi", value: "3" }],
            replies: [{ kind: "retry", text: null, byName: "Lan" }],
            revision: 1,
        })
        expect(stopCardViewOf(JSON.stringify({ kind: "message.text", payload: { text: "x" } }), () => "")).toBeNull()
        expect(stopCardViewOf("not json", () => "")).toBeNull()
        expect(stopCardViewOf(null, () => "")).toBeNull()
    })

    it("shows an old-engine card the same way, its heading being the card's title", () => {
        expect(stopCardViewOf(envelope(BASE, "Quy trình đang dừng, cần bạn trả lời"), () => "")).toMatchObject({
            stopId: null,
            state: "open",
            headline: "Quy trình đang dừng, cần bạn trả lời",
            needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
            revision: 0,
        })
    })
})

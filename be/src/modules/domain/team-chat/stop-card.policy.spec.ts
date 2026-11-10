import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("stop-card.policy")

const policy = {
    countedSectionOf,
    givenSectionOf,
    legacySectionOf,
    resolvedSectionOf,
    stopCardViewOf,
    stopIntentOf,
    stopReplyUsersOf,
    storedStopCardOf,
    typedPayloadOf,
}

const buildSubject = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: policy }] }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

const AT = "2026-11-10T10:00:00.000Z"

const BASE = {
    workflow: { moduleKey: "sales", key: "consult", title: "Sales consult" },
    step: { key: "consult", nodeId: "sales.consult", title: "Consult" },
    runId: "run-1",
    leadId: "lead-1",
    conversationId: "conv-1",
    by: "engine" as const,
    reason: "The AI gave no answer after 3 calls. The customer has no reply to the last message yet.",
    question: null,
    facts: [{ name: "Calls", value: "3" }],
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
    headline: "The workflow stopped: AI error",
    needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
    replies: [],
    repeats: 1,
    stoppedAt: AT,
    resolvedAt: null,
}

const NOTHING = { answer: false, decisions: [], verdicts: [] }

const envelope = (payload: unknown, title = "The workflow stopped"): string =>
    JSON.stringify({ kind: "workflow.stopped", intent: "ask", title, summary: "x", payload })

describe("the typed part of a stop card", () => {
    it("reads the part the engine handed under card.stop, and none when it is absent or wrong", async () => {
        const subject = await buildSubject()
        expect(subject.givenSectionOf({ ...BASE, stop: GIVEN })).toEqual(GIVEN)
        expect(subject.givenSectionOf(BASE)).toBeNull()
        expect(subject.givenSectionOf({ ...BASE, stop: { ...GIVEN, state: "parked" } })).toBeNull()
        expect(subject.givenSectionOf(null)).toBeNull()
    })

    it("counts every write: the first is 1, the next one more than the stored one", async () => {
        const subject = await buildSubject()
        const first = subject.countedSectionOf(GIVEN, null)
        expect(first.revision).toBe(1)
        expect(subject.countedSectionOf(GIVEN, first).revision).toBe(2)
    })

    it("keeps the suggestions and buttons only while asked, and follows the stop's resolution", async () => {
        const subject = await buildSubject()
        const open = subject.countedSectionOf(GIVEN, null)
        const suggestions = [{ text: "Call the customer", handledBy: "person" as const }]
        expect(subject.typedPayloadOf({ ...BASE, suggestions }, open)).toMatchObject({
            decisions: ["retry", "take_over", "skip"],
            suggestions,
            stop: open,
        })
        expect(subject.stopIntentOf(open)).toBe("ask")

        const skipped: StopCardSection = { ...open, state: "skipped", needs: NOTHING, resolvedAt: AT }
        expect(subject.typedPayloadOf({ ...BASE, suggestions }, skipped)).toMatchObject({
            decisions: [],
            suggestions: [],
            resolvedAt: AT,
        })
        expect(subject.stopIntentOf(skipped)).toBe("notify")
    })

    it("marks a stored part resolved on the old resolve path, a skipped one staying skipped", async () => {
        const subject = await buildSubject()
        const open = subject.countedSectionOf(GIVEN, null)
        expect(subject.resolvedSectionOf(open, AT)).toMatchObject({
            state: "resolved",
            resolvedAt: AT,
            needs: NOTHING,
            revision: 2,
        })
        expect(subject.resolvedSectionOf({ ...open, state: "skipped" }, AT).state).toBe("skipped")
    })

    it("reads a card of the old engine as a typed stop: engine-worded is NIVO's report, open until resolved, its buttons kept", async () => {
        const subject = await buildSubject()
        expect(subject.legacySectionOf(BASE, "The workflow stopped")).toMatchObject({
            stopId: null,
            kind: "ai_error",
            state: "open",
            needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
            replies: [],
            revision: 0,
        })
        expect(subject.legacySectionOf({ ...BASE, by: "ai", resolvedAt: AT }, "t")).toMatchObject({
            kind: "ai_report",
            state: "resolved",
            needs: NOTHING,
        })
    })
})

describe("a stored stop card as a screen shows it", () => {
    it("shows a typed card with its replies named, and none for a line that is no stop card", async () => {
        const subject = await buildSubject()
        const section = subject.countedSectionOf(
            {
                ...GIVEN,
                state: "answered",
                needs: NOTHING,
                replies: [{ kind: "retry", text: null, by: "seat-1", at: AT }],
            },
            null,
        )
        const line = envelope(subject.typedPayloadOf(BASE, section))
        expect(subject.storedStopCardOf(line)?.section).toEqual(section)
        expect(subject.stopReplyUsersOf(line)).toEqual(["seat-1"])
        expect(subject.stopCardViewOf(line, (id) => (id === "seat-1" ? "Lan" : ""))).toMatchObject({
            kind: "ai_error",
            by: "engine",
            state: "answered",
            headline: "The workflow stopped: AI error",
            workflowTitle: "Sales consult",
            stepTitle: "Consult",
            message: BASE.reason,
            facts: [{ name: "Calls", value: "3" }],
            replies: [{ kind: "retry", text: null, byName: "Lan" }],
            revision: 1,
        })
        expect(
            subject.stopCardViewOf(JSON.stringify({ kind: "message.text", payload: { text: "x" } }), () => ""),
        ).toBeNull()
        expect(subject.stopCardViewOf("not json", () => "")).toBeNull()
        expect(subject.stopCardViewOf(null, () => "")).toBeNull()
    })

    it("shows each fact with its technical mark: false for a fact stored before facts were worded, true for a raw value", async () => {
        const subject = await buildSubject()
        const section = subject.countedSectionOf(GIVEN, null)
        const worded = {
            ...BASE,
            facts: [
                { name: "Reason", value: "The AI could not tell what to do at this step.", technical: false },
                { name: "Error code", value: "ai_confused", technical: true },
            ],
        }
        expect(subject.stopCardViewOf(envelope(subject.typedPayloadOf(worded, section)), () => "")?.facts).toEqual(worded.facts)
        expect(subject.stopCardViewOf(envelope(subject.typedPayloadOf(BASE, section)), () => "")?.facts).toEqual([
            { name: "Calls", value: "3", technical: false },
        ])
    })

    it("shows an old-engine card the same way, its heading being the card's title", async () => {
        const subject = await buildSubject()
        expect(
            subject.stopCardViewOf(envelope(BASE, "A workflow stopped, it needs your answer"), () => ""),
        ).toMatchObject({
            stopId: null,
            state: "open",
            headline: "A workflow stopped, it needs your answer",
            needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
            revision: 0,
        })
    })
})

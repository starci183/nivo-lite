import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { StopBuild } from "./run-stop-records.service"
import type { RunStop, StopOpen } from "./run-stop.contracts"
import { RunStopsService } from "./run-stops.service"
import { StopCardsService } from "./stop-cards.service"

const NOW = "2026-11-10T10:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }

/** A bank-fed run: no customer, no conversation. */
const OPEN: StopOpen = {
    workspaceId: "ws-1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: "wf-1",
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    reason: "Khoản 1.000đ, nội dung không chỉ đơn nào",
    question: "Khoản này của đơn SO-0003?",
    suggestions: [{ text: "Ghi nhận cho SO-0003", handledBy: "workflow" }],
    facts: [{ name: "amount", value: "1.000đ" }],
    card: {
        locale: "vi",
        workflow: { moduleKey: "accounting", key: "reconcile", title: "Đối soát tiền về" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "Khớp tiền với đơn" },
        by: "ai",
    },
}

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: "wf-1",
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: OPEN.reason,
    question: OPEN.question,
    detail: { suggestions: [...OPEN.suggestions], facts: [...OPEN.facts] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: NOW,
    resolvedAt: null,
    ...over,
})

/** The records in memory: one stop, patched as the engine would. */
const build = async (initial: RunStop | null = stopOf()) => {
    let current = initial
    const records = mock<RunStopRecordsService>({
        open: jest.fn(() => {
            current = current ?? stopOf()
            return Promise.resolve(current)
        }),
        byRunStep: jest.fn(() => Promise.resolve(current)),
        patch: jest.fn((_ws: string, _id: string, build: StopBuild) => {
            if (current === null) return Promise.resolve(null)
            const values = build(current)
            if (values === null) return Promise.resolve(null)
            current = { ...current, ...values, version: String(Number(current.version) + 1) }
            return Promise.resolve(current)
        }),
    })
    const cards = mock<StopCardsService>({
        posted: jest.fn().mockResolvedValue("msg-1"),
        resolved: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunStopsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: RunStopRecordsService, useValue: records },
            { provide: StopCardsService, useValue: cards },
        ],
    }).compile()
    return { stops: moduleRef.get(RunStopsService), records, cards, current: () => current }
}

describe("RunStopsService.stopped: every run that cannot go on gets the same stop, with a customer or without", () => {
    it("opens the stop of a bank-fed run, posts its card once and keeps the card's message, and answers the gate's question", async () => {
        const { stops, records, cards, current } = await build()

        await expect(stops.stopped(OPEN)).resolves.toEqual({
            stopId: "stop-1",
            runId: "run-1",
            stepKey: "match",
            kind: "ai_report",
            reason: OPEN.reason,
            question: OPEN.question,
        })

        expect(records.open).toHaveBeenCalledWith(OPEN, NOW)
        expect(cards.posted).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "stop-1" }), OPEN.card, NOW)
        expect(current()?.cardMessageId).toBe("msg-1")
    })

    it("writes the card's message once: the same message again changes nothing", async () => {
        const { stops, records } = await build(stopOf({ cardMessageId: "msg-1" }))
        await stops.stopped(OPEN)
        expect(records.patch).not.toHaveBeenCalled()
    })
})

describe("RunStopsService.decide: the founder's answer reaches a bank-fed run like any other", () => {
    it("keeps the founder's words on the stop and sends the thread back to the step with them; the stop stays open", async () => {
        const { stops, cards, current } = await build()

        const route = await stops.decide(
            REF,
            "match",
            { kind: "answer", text: "Đúng, của SO-0003", by: "owner-1", at: "2026-11-10T10:05:00.000Z" },
            "__freeze",
            { locale: "vi" },
        )

        expect(route).toEqual({
            goto: "match",
            founderAnswers: [{ text: "Đúng, của SO-0003", at: "2026-11-10T10:05:00.000Z" }],
            resolves: false,
        })
        expect(current()).toMatchObject({
            state: "open",
            answers: [{ kind: "answer", text: "Đúng, của SO-0003", by: "owner-1" }],
            decision: { kind: "answer" },
        })
        expect(cards.resolved).not.toHaveBeenCalled()
    })

    it("resolves the stop and rewrites its card at once on skip", async () => {
        const { stops, cards, current } = await build(stopOf({ cardMessageId: "msg-1" }))

        await expect(
            stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: "t" }, "__freeze", { locale: "vi" }),
        ).resolves.toMatchObject({ goto: "__end__", resolves: true })

        expect(current()).toMatchObject({ state: "resolved", resolvedAt: NOW })
        expect(cards.resolved).toHaveBeenCalledWith("ws-1", expect.objectContaining({ state: "resolved" }), "vi", NOW)
    })

    it("refuses a value that is no decision, a stop that is not there, and a late decision on a resolved stop", async () => {
        const open = await build()
        await expect(open.stops.decide(REF, "match", { kind: "approve" }, "__freeze", { locale: "vi" })).rejects.toMatchObject({
            code: RunStopsErrorCode.DecisionInvalid,
        })
        const none = await build(null)
        await expect(
            none.stops.decide(REF, "match", { kind: "retry", by: "u", at: "t" }, "__freeze", { locale: "vi" }),
        ).rejects.toMatchObject({ code: RunStopsErrorCode.NotFound })
        const resolved = await build(stopOf({ state: "resolved" }))
        await expect(
            resolved.stops.decide(REF, "match", { kind: "retry", by: "u", at: "t" }, "__freeze", { locale: "vi" }),
        ).rejects.toMatchObject({ code: RunStopsErrorCode.AlreadyResolved })
    })
})

describe("RunStopsService.completed and the per-stop send guard", () => {
    it("resolves an open stop when its step completes and rewrites the card; nothing for a step with no open stop", async () => {
        const { stops, cards, current } = await build(stopOf({ cardMessageId: "msg-1" }))
        await stops.completed(REF, "match", { locale: "vi" })
        expect(current()).toMatchObject({ state: "resolved" })
        expect(cards.resolved).toHaveBeenCalledTimes(1)

        await stops.completed(REF, "match", { locale: "vi" })
        expect(cards.resolved).toHaveBeenCalledTimes(1)
    })

    it("keeps each line sent while the stop is open once, and refuses a second line to that customer until the founder answers in words", async () => {
        const { stops, current } = await build()
        const line = { conversationId: "conv-9", text: "Dạ tiệm đã nhận 1.000đ, đang kiểm tra ạ", at: "2026-11-10T10:00:05.000Z" }

        await stops.lineSent(REF, "match", line)
        await stops.lineSent(REF, "match", line)
        expect(current()?.customerLines).toEqual([line])
        await expect(stops.sendRefusal(REF, "match", "conv-9")).resolves.toEqual({
            code: "already_told_for_this_stop",
            line,
        })

        await stops.decide(REF, "match", { kind: "retry", by: "owner-1", at: "2026-11-10T10:01:00.000Z" }, "__freeze", {
            locale: "vi",
        })
        await expect(stops.sendRefusal(REF, "match", "conv-9")).resolves.not.toBeNull()

        await stops.decide(
            REF,
            "match",
            { kind: "answer", text: "ghi nhận", by: "owner-1", at: "2026-11-10T10:02:00.000Z" },
            "__freeze",
            { locale: "vi" },
        )
        await expect(stops.sendRefusal(REF, "match", "conv-9")).resolves.toBeNull()
    })
})

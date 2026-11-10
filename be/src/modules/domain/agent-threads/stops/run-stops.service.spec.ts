import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { StopBuild } from "./run-stop-records.service"
import type { RunStop, StopOpen } from "./run-stop.contracts"
import { RunStopsService, linesWithSendsOf, type KeptSend } from "./run-stops.service"
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
        rewritten: jest.fn().mockResolvedValue(undefined),
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

    it("rewrites the same card in place once per decision that keeps the stop open, with the trace so far", async () => {
        const { stops, cards } = await build(stopOf({ cardMessageId: "msg-1" }))
        const answer = { kind: "answer", text: "Cua SO-0003", by: "owner-1", at: "2026-11-10T10:05:00.000Z" }

        await stops.decide(REF, "match", answer, "__freeze", { locale: "vi" })
        await stops.decide(REF, "match", answer, "__freeze", { locale: "vi" })
        await stops.decide(REF, "match", { kind: "retry", by: "owner-1", at: "2026-11-10T10:06:00.000Z" }, "__freeze", {
            locale: "vi",
        })

        expect(cards.rewritten).toHaveBeenCalledTimes(2)
        expect(cards.rewritten).toHaveBeenNthCalledWith(
            1,
            "ws-1",
            expect.objectContaining({ cardMessageId: "msg-1", state: "open", answers: [expect.objectContaining({ kind: "answer" })] }),
            "vi",
        )
        expect(cards.rewritten).toHaveBeenNthCalledWith(
            2,
            "ws-1",
            expect.objectContaining({
                cardMessageId: "msg-1",
                state: "open",
                answers: [expect.objectContaining({ kind: "answer" }), expect.objectContaining({ kind: "retry" })],
            }),
            "vi",
        )
        expect(cards.posted).not.toHaveBeenCalled()
        expect(cards.resolved).not.toHaveBeenCalled()
    })

    it("does not rewrite the open card on skip: the resolved card is written instead", async () => {
        const { stops, cards } = await build(stopOf({ cardMessageId: "msg-1" }))

        await stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: "t" }, "__freeze", { locale: "vi" })

        expect(cards.rewritten).not.toHaveBeenCalled()
        expect(cards.resolved).toHaveBeenCalledTimes(1)
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

describe("RunStopsService.stopped: the stop holds what the step told customers, read from the effect ledger (D.1)", () => {
    const sendOf = (over: Partial<KeptSend> = {}): KeptSend => ({
        args: { leadId: "lead-9", text: "Shop da nhan, dang kiem tra a." },
        subject: { kind: "message", id: "m-1", facts: { conversationId: "conv-9", delivery: "acknowledged" } },
        at: "2026-11-10T09:59:00.000Z",
        ...over,
    })

    const withLedger = async (sends: ReadonlyArray<KeptSend>) => {
        const ledger = mock<GraphNodeEffectsService>({ recordsOf: jest.fn().mockResolvedValue(sends) })
        const records = mock<RunStopRecordsService>()
        let current = stopOf()
        records.open.mockImplementation(() => Promise.resolve(current))
        records.patch.mockImplementation((_ws: string, _id: string, change: StopBuild) => {
            const values = change(current)
            if (values === null) return Promise.resolve(null)
            current = { ...current, ...values }
            return Promise.resolve(current)
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                RunStopsService,
                { provide: CLOCK, useValue: new FakeClock(NOW) },
                { provide: RunStopRecordsService, useValue: records },
                { provide: StopCardsService, useValue: mock<StopCardsService>({ posted: jest.fn().mockResolvedValue(null) }) },
                { provide: GraphNodeEffectsService, useValue: ledger },
            ],
        }).compile()
        return { stops: moduleRef.get(RunStopsService), ledger, current: () => current }
    }

    it("a bank-fed run's line to the order's customer lands on the stop, with the conversation the send went to", async () => {
        const { stops, ledger, current } = await withLedger([sendOf()])

        await stops.stopped(OPEN)

        expect(ledger.recordsOf).toHaveBeenCalledWith("ws-1", { runId: "run-1", stepKey: "match" }, ["customer.message.send"])
        expect(current().customerLines).toEqual([
            { conversationId: "conv-9", text: "Shop da nhan, dang kiem tra a.", at: "2026-11-10T09:59:00.000Z" },
        ])
    })

    it("keeps each line once when the stop opens again, and leaves out a send with no words or no conversation", async () => {
        const { stops, current } = await withLedger([
            sendOf(),
            sendOf({ args: null }),
            sendOf({ args: { text: "x" }, subject: { kind: "message", id: "m-2" } }),
        ])

        await stops.stopped(OPEN)
        await stops.stopped(OPEN)

        expect(current().customerLines).toHaveLength(1)
    })
})

describe("linesWithSendsOf", () => {
    it("adds the ledger's sends after the lines the stop holds, oldest first, and answers null when it adds nothing", () => {
        const held = { conversationId: "conv-1", text: "A", at: "2026-11-10T09:00:00.000Z" }
        const send: KeptSend = {
            args: { conversationId: "conv-1", text: "B" },
            subject: { kind: "message", id: "m-1" },
            at: "2026-11-10T08:00:00.000Z",
        }

        expect(linesWithSendsOf([held], [send])).toEqual([{ conversationId: "conv-1", text: "B", at: send.at }, held])
        expect(linesWithSendsOf([held], [{ ...send, args: { conversationId: "conv-1", text: "A" } }])).toBeNull()
        expect(linesWithSendsOf([], [])).toBeNull()
    })
})

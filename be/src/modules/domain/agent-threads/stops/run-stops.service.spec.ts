import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { StopBuild } from "./run-stop-records.service"
import type { RunStop, StopOpen } from "./run-stop.contracts"
import { RunStopsService, linesWithSendsOf, toldCustomerOf, type KeptSend } from "./run-stops.service"
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
const build = async (initial: RunStop | null = stopOf(), work: WorkEngineService | null = null) => {
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
            ...(work === null ? [] : [{ provide: WorkEngineService, useValue: work }]),
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

    const withLedger = async (sends: ReadonlyArray<KeptSend>, initial: RunStop = stopOf()) => {
        const ledger = mock<GraphNodeEffectsService>({ recordsOf: jest.fn().mockResolvedValue(sends) })
        const records = mock<RunStopRecordsService>()
        let current = initial
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

        expect(ledger.recordsOf).toHaveBeenCalledWith("ws-1", { runId: "run-1", stepKey: "match" }, ["nivo.lead.message.send"])
        expect(current().customerLines).toEqual([
            { conversationId: "conv-9", text: "Shop da nhan, dang kiem tra a.", at: "2026-11-10T09:59:00.000Z" },
        ])
    })

    it("D-P11-4: a stop of a run about no customer takes the customer its step told (conversation + the send's lead), so the hold finds it", async () => {
        const { stops, current } = await withLedger([sendOf()])

        await stops.stopped(OPEN)

        expect(current()).toMatchObject({ leadId: "lead-9", conversationId: "conv-9" })
    })

    it("D-P11-4: a stop of a run with its own customer keeps it, whoever the step told", async () => {
        const { stops, current } = await withLedger([sendOf()], stopOf({ leadId: "lead-1", conversationId: "conv-1" }))

        await stops.stopped({ ...OPEN, leadId: "lead-1", conversationId: "conv-1" })

        expect(current()).toMatchObject({ leadId: "lead-1", conversationId: "conv-1" })
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

describe("toldCustomerOf", () => {
    const line = (conversationId: string, at: string) => ({ conversationId, text: "Shop dang kiem tra", at })
    const none = { leadId: null, conversationId: null }

    it("names the conversation of the oldest line told and the lead a send to it named; null when the stop has a customer or told nobody", () => {
        const send: KeptSend = {
            args: { leadId: "lead-9", text: "Shop dang kiem tra" },
            subject: { kind: "message", id: "m-1", facts: { conversationId: "conv-9" } },
            at: "2026-11-10T09:00:00.000Z",
        }

        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z"), line("conv-2", "2026-11-10T08:00:00.000Z")], [send])).toEqual({
            leadId: null,
            conversationId: "conv-2",
        })
        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z")], [send])).toEqual({ leadId: "lead-9", conversationId: "conv-9" })
        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z")])).toEqual({ leadId: null, conversationId: "conv-9" })
        expect(toldCustomerOf({ leadId: "lead-1", conversationId: null }, [line("conv-9", "2026-11-10T09:00:00.000Z")], [send])).toBeNull()
        expect(toldCustomerOf(none, [])).toBeNull()
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

// FX4 (D-P11-6): skipping an approval stop left its `approve_tool_call` item waiting in the owner's inbox (the run-page door then
// answered `decision_not_found`). Any decision that closes the stop other than its item's own verdict withdraws the item.
describe("RunStopsService: an approval stop that closes another way withdraws its item", () => {
    const approvalStop = (facts: ReadonlyArray<readonly [string, string]> = []) =>
        stopOf({
            kind: "approval",
            detail: {
                suggestions: [],
                facts: [["tool", "nivo.x"], ["workItemId", "item-1"], ["fingerprint", "f-1"], ...facts].map(([name, value]) => ({
                    name,
                    value,
                })),
            },
        })
    const workOf = (): WorkEngineService & { readonly resumeWork: jest.Mock } =>
        mock<WorkEngineService>({ resumeWork: jest.fn().mockResolvedValue({}) }) as WorkEngineService & {
            readonly resumeWork: jest.Mock
        }
    const factOf = (stop: RunStop | null, name: string) => stop?.detail.facts.find((fact) => fact.name === name)?.value ?? null

    it.each(["skip", "answer", "retry", "take_over"] as const)(
        "%s: the stop keeps `withdrawn` first, then the item is closed rejected by the engine with the reason",
        async (kind) => {
            const work = workOf()
            const { stops, current } = await build(approvalStop(), work)
            const decision =
                kind === "answer"
                    ? { kind, text: "Khong can", by: "owner-1", at: NOW }
                    : { kind, by: "owner-1", at: NOW }

            await stops.decide(REF, "match", decision, "__freeze", { locale: "vi" })

            expect(factOf(current(), "verdict")).toBe("withdrawn")
            expect(work.resumeWork).toHaveBeenCalledTimes(1)
            expect(work.resumeWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
                "item-1",
                "rejected",
                {},
                { name: "NIVO", kind: "staff" },
                `withdrawn:stop_${kind}`,
            )
        },
    )

    it("the item's own verdict (kept on the stop before it resumes the thread) withdraws nothing", async () => {
        const work = workOf()
        const { stops } = await build(approvalStop([["verdict", "approved:owner-1"]]), work)

        await stops.decide(REF, "match", { kind: "retry", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" })

        expect(work.resumeWork).not.toHaveBeenCalled()
    })

    it("the run closing and the step completing withdraw it too; a stop of another kind has no item", async () => {
        const closing = workOf()
        const completing = workOf()
        const other = workOf()
        const closed = await build(approvalStop(), closing)
        closed.records.ofRun.mockResolvedValue([approvalStop()])
        const completed = await build(approvalStop(), completing)
        const plain = await build(stopOf(), other)

        await closed.stops.runClosed(REF, { locale: "vi" })
        await completed.stops.completed(REF, "match", { locale: "vi" })
        await plain.stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" })

        expect(closing.resumeWork.mock.calls[0]?.[5]).toBe("withdrawn:run_closed")
        expect(completing.resumeWork.mock.calls[0]?.[5]).toBe("withdrawn:step_completed")
        expect(other.resumeWork).not.toHaveBeenCalled()
    })

    it("a stop resolved before items were withdrawn: a late decision withdraws the item it left open, once", async () => {
        const work = workOf()
        const { stops } = await build({ ...approvalStop(), state: "resolved" }, work)

        expect(await stops.leftoverWithdrawn(REF, "match", { locale: "vi" })).toBe(true)
        expect(await stops.leftoverWithdrawn(REF, "match", { locale: "vi" })).toBe(false)
        expect(work.resumeWork).toHaveBeenCalledTimes(1)
        expect(work.resumeWork.mock.calls[0]?.[5]).toBe("withdrawn:stop_closed_earlier")
    })

    it("an item a person decided meanwhile stays as it is (the work engine refuses): the decision still stands", async () => {
        const work = mock<WorkEngineService>({ resumeWork: jest.fn().mockRejectedValue(new Error("not waiting")) })
        const { stops } = await build(approvalStop(), work)

        await expect(
            stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" }),
        ).resolves.toMatchObject({ resolves: true })
    })
})

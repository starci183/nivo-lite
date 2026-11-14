import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import {
    ACK_LINE_VI,
    AMOUNT_ONE_THOUSAND_VI,
    BOOK_IT_LOWER_VI,
    BOOK_SO3_SUGGESTION_VI,
    CREDIT_NO_ORDER_REASON_VI,
    CREDIT_ORDER_QUESTION_VI,
    MATCH_STEP_TITLE_VI,
    RECONCILE_TITLE_VI,
    YES_SO3_ANSWER_VI,
} from "@tests/fixtures/i18n/agent-threads-spec.messages"
import { ApprovalItemsService } from "./approval-items.service"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService, type StopBuild } from "./run-stop-records.service"
import type { RunStop, StopOpen } from "./run-stop.contracts"
import { RunStopsService, linesWithSendsOf, toldCustomerOf, type KeptSend } from "./run-stops.service"
import { StopCardsService } from "./stop-cards.service"
import { stopToldOf } from "./stop-gate.policy"

const NOW = "2026-11-10T10:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }

/** A bank-fed run: no customer, no conversation. */
const OPEN: StopOpen = {
    workspaceId: "ws-1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    reason: CREDIT_NO_ORDER_REASON_VI,
    question: CREDIT_ORDER_QUESTION_VI,
    suggestions: [{ text: BOOK_SO3_SUGGESTION_VI, handledBy: "workflow" }],
    facts: [{ name: "amount", value: AMOUNT_ONE_THOUSAND_VI }],
    card: {
        locale: "vi",
        workflow: { moduleKey: "accounting", key: "reconcile", title: RECONCILE_TITLE_VI },
        step: { key: "match", nodeId: "accounting.match-payment", title: MATCH_STEP_TITLE_VI },
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
    contactId: null,
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
const memoryStopOf = (initial: RunStop | null) => {
    let current = initial
    const methods: Partial<RunStopRecordsService> = {
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
    }
    return { methods, current: () => current }
}

/** The card door: the card posts as msg-1, rewrites and resolutions succeed. */
const cardAnswers = (): Partial<StopCardsService> => ({
    posted: jest.fn().mockResolvedValue("msg-1"),
    resolved: jest.fn().mockResolvedValue(undefined),
    rewritten: jest.fn().mockResolvedValue(undefined),
})

/** The service over one stop in memory, in an app without the work engine. */
const build = async (initial: RunStop | null = stopOf()) => {
    const memory = memoryStopOf(initial)
    const records = mock<RunStopRecordsService>(memory.methods)
    const cards = mock<StopCardsService>(cardAnswers())
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunStopsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: RunStopRecordsService, useValue: records },
            { provide: StopCardsService, useValue: cards },
        ],
    }).compile()
    return { stops: moduleRef.get(RunStopsService), records, cards, current: memory.current }
}

/** The service over one stop in memory, with the approval items that close an approval stop's item. */
const buildWithWork = async (initial: RunStop) => {
    const memory = memoryStopOf(initial)
    const records = mock<RunStopRecordsService>(memory.methods)
    const cards = mock<StopCardsService>(cardAnswers())
    const work = mock<ApprovalItemsService>()
    work.withdrawn.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunStopsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: RunStopRecordsService, useValue: records },
            { provide: StopCardsService, useValue: cards },
            { provide: ApprovalItemsService, useValue: work },
        ],
    }).compile()
    return { stops: moduleRef.get(RunStopsService), records, work, current: memory.current }
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
            { kind: "answer", text: YES_SO3_ANSWER_VI, by: "owner-1", at: "2026-11-10T10:05:00.000Z" },
            "__freeze",
            { locale: "vi" },
        )

        expect(route).toEqual({
            goto: "match",
            founderAnswers: [{ text: YES_SO3_ANSWER_VI, at: "2026-11-10T10:05:00.000Z" }],
            resolves: false,
        })
        expect(current()).toMatchObject({
            state: "open",
            answers: [{ kind: "answer", text: YES_SO3_ANSWER_VI, by: "owner-1" }],
            decision: { kind: "answer" },
        })
        expect(cards.resolved).not.toHaveBeenCalled()
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
})

describe("RunStopsService.decide: a skip resolves the stop, and what is no decision is refused", () => {
    it("resolves the stop and rewrites its card at once on skip", async () => {
        const { stops, cards, current } = await build(stopOf({ cardMessageId: "msg-1" }))

        await expect(
            stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: "t" }, "__freeze", { locale: "vi" }),
        ).resolves.toMatchObject({ goto: "__end__", resolves: true })

        expect(current()).toMatchObject({ state: "resolved", resolvedAt: NOW })
        expect(cards.resolved).toHaveBeenCalledWith("ws-1", expect.objectContaining({ state: "resolved" }), "vi", NOW)
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

    it("keeps each line sent while the stop is open once: the told line stands through a retry, the founder's words clear it", async () => {
        const { stops, current } = await build()
        const line = { conversationId: "conv-9", text: ACK_LINE_VI, at: "2026-11-10T10:00:05.000Z" }

        await stops.lineSent(REF, "match", line)
        await stops.lineSent(REF, "match", line)
        expect(current()?.customerLines).toEqual([line])

        await stops.decide(REF, "match", { kind: "retry", by: "owner-1", at: "2026-11-10T10:01:00.000Z" }, "__freeze", {
            locale: "vi",
        })
        const retried = current()
        expect(retried === null ? null : stopToldOf(retried)).toEqual(line)

        await stops.decide(
            REF,
            "match",
            { kind: "answer", text: BOOK_IT_LOWER_VI, by: "owner-1", at: "2026-11-10T10:02:00.000Z" },
            "__freeze",
            { locale: "vi" },
        )
        const answered = current()
        expect(answered === null ? undefined : stopToldOf(answered)).toBeNull()
    })
})

describe("RunStopsService.stopped: the stop holds what the step told customers, read from the effect ledger (D.1)", () => {
    const sendOf = (over: Partial<KeptSend> = {}): KeptSend => ({
        args: { contactId: "lead-9", text: "Shop da nhan, dang kiem tra a." },
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

        expect(ledger.recordsOf).toHaveBeenCalledWith("ws-1", { runId: "run-1", stepKey: "match" }, ["nivo.tool.customer.message.send"])
        expect(current().customerLines).toEqual([
            { conversationId: "conv-9", text: "Shop da nhan, dang kiem tra a.", at: "2026-11-10T09:59:00.000Z" },
        ])
    })

    it("D-P11-4: a stop of a run about no customer takes the customer its step told (conversation + the send's lead), so the hold finds it", async () => {
        const { stops, current } = await withLedger([sendOf()])

        await stops.stopped(OPEN)

        expect(current()).toMatchObject({ contactId: "lead-9", conversationId: "conv-9" })
    })

    it("D-P11-4: a stop of a run with its own customer keeps it, whoever the step told", async () => {
        const { stops, current } = await withLedger([sendOf()], stopOf({ contactId: "lead-1", conversationId: "conv-1" }))

        await stops.stopped({ ...OPEN, contactId: "lead-1", conversationId: "conv-1" })

        expect(current()).toMatchObject({ contactId: "lead-1", conversationId: "conv-1" })
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

describe("RunStopsService.factsAdded: what arrives for an open stop rewrites its one card in place (D-MX-3)", () => {
    const JOINED = { name: "creditJoined:tx-2", value: "1000 VND - DH202611110005" }

    it("adds the facts to the open stop, replaces a fact of the same name, and rewrites the card; a repeat writes nothing", async () => {
        const { stops, cards, current } = await build(stopOf({ cardMessageId: "msg-1" }))

        await expect(
            stops.factsAdded(REF, "match", [JOINED, { name: "receivedTotalVnd", value: "1000" }], { locale: "vi" }),
        ).resolves.toBe(true)
        await expect(stops.factsAdded(REF, "match", [{ name: "receivedTotalVnd", value: "2000" }], { locale: "vi" })).resolves.toBe(true)
        await expect(stops.factsAdded(REF, "match", [{ name: "receivedTotalVnd", value: "2000" }], { locale: "vi" })).resolves.toBe(false)

        expect(current()?.detail.facts).toEqual([...OPEN.facts, JOINED, { name: "receivedTotalVnd", value: "2000" }])
        expect(cards.rewritten).toHaveBeenCalledTimes(2)
    })

    it("writes nothing on a stop that is resolved or gone", async () => {
        const resolved = await build(stopOf({ state: "resolved" }))
        await expect(resolved.stops.factsAdded(REF, "match", [JOINED], { locale: "vi" })).resolves.toBe(false)
        expect(resolved.cards.rewritten).not.toHaveBeenCalled()

        const gone = await build(null)
        await expect(gone.stops.factsAdded(REF, "match", [JOINED], { locale: "vi" })).resolves.toBe(false)
    })
})

describe("toldCustomerOf", () => {
    const line = (conversationId: string, at: string) => ({ conversationId, text: "Shop dang kiem tra", at })
    const none = { contactId: null, conversationId: null }

    it("names the conversation of the oldest line told and the lead a send to it named; null when the stop has a customer or told nobody", () => {
        const send: KeptSend = {
            args: { contactId: "lead-9", text: "Shop dang kiem tra" },
            subject: { kind: "message", id: "m-1", facts: { conversationId: "conv-9" } },
            at: "2026-11-10T09:00:00.000Z",
        }

        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z"), line("conv-2", "2026-11-10T08:00:00.000Z")], [send])).toEqual({
            contactId: null,
            conversationId: "conv-2",
        })
        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z")], [send])).toEqual({ contactId: "lead-9", conversationId: "conv-9" })
        expect(toldCustomerOf(none, [line("conv-9", "2026-11-10T09:00:00.000Z")])).toEqual({ contactId: null, conversationId: "conv-9" })
        expect(toldCustomerOf({ contactId: "lead-1", conversationId: null }, [line("conv-9", "2026-11-10T09:00:00.000Z")], [send])).toBeNull()
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

/** An approval stop with its work item, and these facts besides. */
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

/** The value of a fact of the stop, or null. */
const stopFactOf = (stop: RunStop | null, name: string) => stop?.detail.facts.find((fact) => fact.name === name)?.value ?? null

// FX4 (D-P11-6): skipping an approval stop left its `approve_tool_call` item waiting in the owner's inbox (the run-page door then
// answered `decision_not_found`). Any decision that closes the stop other than its item's own verdict withdraws the item.
describe("RunStopsService: an approval stop that closes another way withdraws its item", () => {
    it.each(["skip", "answer", "retry", "take_over"] as const)(
        "%s: the stop keeps `withdrawn` first, then the item is closed refused with the reason",
        async (kind) => {
            const { stops, work, current } = await buildWithWork(approvalStop())
            const decision =
                kind === "answer"
                    ? { kind, text: "Khong can", by: "owner-1", at: NOW }
                    : { kind, by: "owner-1", at: NOW }

            await stops.decide(REF, "match", decision, "__freeze", { locale: "vi" })

            expect(stopFactOf(current(), "verdict")).toBe("withdrawn")
            expect(work.withdrawn).toHaveBeenCalledTimes(1)
            expect(work.withdrawn).toHaveBeenCalledWith("ws-1", "item-1", "vi", `withdrawn:stop_${kind}`)
        },
    )

    it("the item's own verdict (kept on the stop before it resumes the thread) withdraws nothing", async () => {
        const { stops, work } = await buildWithWork(approvalStop([["verdict", "approved:owner-1"]]))

        await stops.decide(REF, "match", { kind: "retry", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" })

        expect(work.withdrawn).not.toHaveBeenCalled()
    })
})

describe("RunStopsService.lineNotTold: an engine line the send refused is kept as NOT told", () => {
    it("keeps the two facts on the open stop, never a line told, and rewrites the card; a second refusal replaces the reason", async () => {
        const { stops, cards, current } = await build()

        await stops.lineNotTold(REF, "match", "ability_off", { locale: "vi" })
        await stops.lineNotTold(REF, "match", "not_attached", { locale: "vi" })

        expect(current()?.customerLines).toEqual([])
        expect(current()?.detail.facts.filter((fact) => fact.name.startsWith("customerLine"))).toEqual([
            { name: "customerLine", value: "not_told" },
            { name: "customerLineReason", value: "not_attached" },
        ])
        expect(cards.rewritten).toHaveBeenCalledTimes(2)
    })

    it("writes nothing for a stop that is resolved or does not exist", async () => {
        const resolved = await build(stopOf({ state: "resolved" }))
        const none = await build(null)

        await resolved.stops.lineNotTold(REF, "match", "ability_off", { locale: "vi" })
        await none.stops.lineNotTold(REF, "match", "ability_off", { locale: "vi" })

        expect(resolved.cards.rewritten).not.toHaveBeenCalled()
        expect(resolved.current()?.detail.facts).toEqual(stopOf().detail.facts)
        expect(none.cards.rewritten).not.toHaveBeenCalled()
    })

    it("writes nothing on an approval stop: its facts and lines stay, its card is not rewritten", async () => {
        const { stops, records, cards, current } = await build(approvalStop())

        await stops.lineNotTold(REF, "match", "ability_off", { locale: "vi" })

        expect(current()).toEqual(approvalStop())
        expect(records.patch).not.toHaveBeenCalled()
        expect(cards.rewritten).not.toHaveBeenCalled()
    })

    it("a line kept as NOT told is no line told: the told line sees none, a later line counts once", async () => {
        const { stops, current } = await build()

        await stops.lineNotTold(REF, "match", "route_held", { locale: "vi" })

        const notTold = current()
        expect(notTold).not.toBeNull()
        if (notTold === null) return
        expect(stopToldOf(notTold)).toBeNull()

        const line = { conversationId: "conv-9", text: ACK_LINE_VI, at: "2026-11-10T10:00:05.000Z" }
        await stops.lineSent(REF, "match", line)
        expect(current()?.customerLines).toEqual([line])
        const told = current()
        expect(told === null ? null : stopToldOf(told)).toEqual(line)
    })
})

describe("RunStopsService.declinedByTakeOver: taking over a permission request IS its decline, by the person", () => {
    const LAN = { memberId: "member-lan", name: "Lan" }

    it("keeps the decline verdict on the stop first, then closes the item refused BY THE PERSON with the take-over note", async () => {
        const { stops, work, current } = await buildWithWork(approvalStop())
        work.withdrawn.mockImplementation(() => {
            // A later verdict on the item must find the verdict already kept (it then hands the thread nothing).
            expect(stopFactOf(current(), "verdict")).toBe("refused")
            return Promise.resolve(true)
        })

        await expect(stops.declinedByTakeOver(REF, "match", LAN, { locale: "vi" })).resolves.toBe(true)

        expect(work.withdrawn).toHaveBeenCalledTimes(1)
        expect(work.withdrawn).toHaveBeenCalledWith("ws-1", "item-1", "vi", "declined_by_takeover:member-lan")
    })

    it("the take-over that follows withdraws nothing: the item was declined once, by one path", async () => {
        const { stops, work, current } = await buildWithWork(approvalStop())

        await stops.declinedByTakeOver(REF, "match", LAN, { locale: "vi" })
        const route = await stops.decide(REF, "match", { kind: "take_over", by: "member-lan", at: NOW }, "__freeze", { locale: "vi" })

        expect(work.withdrawn).toHaveBeenCalledTimes(1)
        expect(stopFactOf(current(), "verdict")).toBe("refused")
        // The thread stays at the gate with the stop open: the step is not run again, so nothing is sent and no report stop opens.
        expect(route.resolves).toBe(false)
        expect(current()?.state).toBe("open")
        expect(current()?.decision?.kind).toBe("take_over")
    })

    it("declines nothing for a stop that is no permission request, one already decided, or a resolved one", async () => {
        const plain = await buildWithWork(stopOf())
        const decided = await buildWithWork(approvalStop([["verdict", "approved:owner-1"]]))
        const resolved = await buildWithWork({ ...approvalStop(), state: "resolved" })

        for (const world of [plain, decided, resolved]) {
            await expect(world.stops.declinedByTakeOver(REF, "match", LAN, { locale: "vi" })).resolves.toBe(false)
            expect(world.work.withdrawn).not.toHaveBeenCalled()
        }
    })
})

describe("RunStopsService: an approval stop's item is withdrawn when the run closes, the step completes, or late", () => {
    it("the run closing and the step completing withdraw it too; a stop of another kind has no item", async () => {
        const closed = await buildWithWork(approvalStop())
        closed.records.ofRun.mockResolvedValue([approvalStop()])
        const completed = await buildWithWork(approvalStop())
        const plain = await buildWithWork(stopOf())

        await closed.stops.runClosed(REF, { locale: "vi" })
        await completed.stops.completed(REF, "match", { locale: "vi" })
        await plain.stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" })

        expect(closed.work.withdrawn.mock.calls[0]?.[3]).toBe("withdrawn:run_closed")
        expect(completed.work.withdrawn.mock.calls[0]?.[3]).toBe("withdrawn:step_completed")
        expect(plain.work.withdrawn).not.toHaveBeenCalled()
    })

    it("a stop resolved before items were withdrawn: a late decision withdraws the item it left open, once", async () => {
        const { stops, work } = await buildWithWork({ ...approvalStop(), state: "resolved" })

        expect(await stops.leftoverWithdrawn(REF, "match", { locale: "vi" })).toBe(true)
        expect(await stops.leftoverWithdrawn(REF, "match", { locale: "vi" })).toBe(false)
        expect(work.withdrawn).toHaveBeenCalledTimes(1)
        expect(work.withdrawn.mock.calls[0]?.[3]).toBe("withdrawn:stop_closed_earlier")
    })

    it("an item a person decided meanwhile stays as it is (nothing left to take): the decision still stands", async () => {
        const { stops, work } = await buildWithWork(approvalStop())
        work.withdrawn.mockResolvedValue(false)

        await expect(
            stops.decide(REF, "match", { kind: "skip", by: "owner-1", at: NOW }, "__freeze", { locale: "vi" }),
        ).resolves.toMatchObject({ resolves: true })
    })
})

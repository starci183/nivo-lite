import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import {
    frozenFreezeOf,
    pendingLineOf,
    pendingPaymentOf,
    releasedFreezeOf,
    stoppedRunOf,
} from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeItemsService } from "./lead-freeze-items.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import type { FreezeBuild } from "./lead-freeze-records.service"
import { LeadFreezeRunsService } from "./lead-freeze-runs.service"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeSubject, LeadFreeze, RetriedRun, StoppedStep } from "./lead-freezes.contracts"

const STOP = {
    workspaceId: "ws-1",
    runId: "run-1",
    code: "GRAPH_NODES_EXECUTOR_MISSING",
    stepKey: "claim-ack",
    trigger: null,
}

const RESUMED: RetriedRun = { resume: { kind: "resumed" }, status: "done" }

/** Where the run of a freeze stands, as a spec moves it. */
interface RunState {
    status: string | null
}

/** The records of the freezes in memory, read and written the way the engine does it. */
const memoryOf = (records: Map<string, LeadFreeze>) => {
    const find = (match: (freeze: LeadFreeze) => boolean): LeadFreeze | null =>
        [...records.values()].find(match) ?? null
    return {
        byKey: (_ws: string, key: string) => Promise.resolve(find((each) => each.key === key)),
        byId: (_ws: string, id: string) => Promise.resolve(records.get(id) ?? null),
        byLead: (_ws: string, leadId: string) => Promise.resolve(find((each) => each.leadId === leadId)),
        byRun: (_ws: string, runId: string) => Promise.resolve(find((each) => each.frozenRunId === runId)),
        holding: () => Promise.resolve([...records.values()].filter((each) => each.status !== "released")),
        ensure: (_ws: string, subject: FreezeSubject) => {
            const found = find((each) => each.key === subject.key)
            if (found !== null) return Promise.resolve(found)
            const made = releasedFreezeOf(subject)
            records.set(made.id, made)
            return Promise.resolve(made)
        },
        patch: (_ws: string, id: string, update: FreezeBuild) => {
            const freeze = records.get(id)
            if (freeze === undefined) return Promise.reject(new Error("gone"))
            const values = update(freeze)
            if (values === null) return Promise.resolve(null)
            const next = { ...freeze, ...values, version: String(Number(freeze.version) + 1) }
            records.set(id, next)
            return Promise.resolve(next)
        },
    }
}

const build = async (initial: LeadFreeze | null = null, status: string | null = "parked") => {
    const records = new Map<string, LeadFreeze>(initial === null ? [] : [[initial.id, initial]])
    const memory = memoryOf(records)
    const store = mock<LeadFreezeRecordsService>({
        byKey: jest.fn(memory.byKey),
        byId: jest.fn(memory.byId),
        byLead: jest.fn(memory.byLead),
        byRun: jest.fn(memory.byRun),
        holding: jest.fn(memory.holding),
        ensure: jest.fn(memory.ensure),
        patch: jest.fn(memory.patch),
        leadOfConversation: jest.fn().mockResolvedValue(null),
        nameOfLead: jest.fn().mockResolvedValue("Nguyen Van A"),
        leadOfTransaction: jest.fn().mockResolvedValue(null),
    })
    const items = mock<LeadFreezeItemsService>({ raise: jest.fn().mockResolvedValue("item-1") })
    const runState: RunState = { status }
    const runs = mock<LeadFreezeRunsService>({
        stoppedOf: jest.fn().mockResolvedValue(stoppedRunOf()),
        statusOf: jest.fn(() => Promise.resolve(runState.status)),
        stepTitleOf: jest.fn().mockResolvedValue("Take a payment claim"),
        keep: jest.fn().mockResolvedValue(true),
        readsCustomerWords: jest.fn().mockResolvedValue(true),
        retry: jest.fn(() => Promise.resolve({ resume: { kind: "resumed" }, status: runState.status })),
        abandon: jest.fn().mockResolvedValue("abandoned"),
    })
    const wakes = mock<LeadFreezeWakesService>({
        replay: jest.fn().mockResolvedValue(1),
        takeOver: jest.fn().mockResolvedValue(undefined),
    })
    const gate = mock<AgentGraphFreezeGateService>()
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:05:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphFreezeGateService, useValue: gate },
            { provide: LeadFreezeRecordsService, useValue: store },
            { provide: LeadFreezeItemsService, useValue: items },
            { provide: LeadFreezeRunsService, useValue: runs },
            { provide: LeadFreezeWakesService, useValue: wakes },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezesService), records, store, items, runs, runState, wakes, gate, logger }
}

/** The ids of the events the last release wrote again, in order. */
const replayedOf = (wakes: ReturnType<typeof mock<LeadFreezeWakesService>>): ReadonlyArray<string> =>
    wakes.replay.mock.calls[0]?.[3].map((each) => each.wakeId) ?? []

const CHAT_TURN = agentTurnViewOf({
    wakeId: "wake-9",
    agentId: "chatbot",
    source: "customer",
    context: { conversationId: "c-1" },
})

const FAILED: StoppedStep = {
    stepKey: "claim-ack",
    nodeKey: "claim-ack",
    kind: "graph_node",
    nodeStep: true,
    errorCode: "GRAPH_NODES_EXECUTOR_MISSING",
    input: { versionId: "v-1", trigger: { conversationId: "c-1", leadId: "lead-1" } },
}

describe("LeadFreezesService registration", () => {
    it("registers with the gate of the graph flows once the app has started", async () => {
        const { service, gate } = await build()
        service.onModuleInit()
        expect(gate.set).toHaveBeenCalledWith(service)
    })
})

describe("LeadFreezesService.hold: the start of a run of a frozen customer", () => {
    it("admits a wake whose customer is not frozen, and one that names nobody", async () => {
        const { service } = await build(releasedFreezeOf())
        await expect(service.hold(CHAT_TURN, { leadId: "lead-1", conversationId: "c-1" })).resolves.toBe(false)
        await expect(service.hold(CHAT_TURN, {})).resolves.toBe(false)
    })

    it("holds a line of the frozen lead and records it as a pending event, once per wake", async () => {
        const { service, records, logger } = await build(frozenFreezeOf())
        const trigger = { leadId: "lead-1", conversationId: "c-1", messageIds: ["m-9"] }

        await expect(service.hold(CHAT_TURN, trigger)).resolves.toBe(true)
        await expect(service.hold(CHAT_TURN, trigger)).resolves.toBe(true)

        expect(records.get("freeze-1")?.pending).toEqual([
            expect.objectContaining({ wakeId: "wake-9", kind: "message", conversationId: "c-1", messageIds: ["m-9"] }),
        ])
        expect(logger.info).toHaveBeenCalledWith(
            LeadFreezesLogEvent.EventHeld,
            expect.objectContaining({ wakeId: "wake-9" }),
        )
    })

    it("finds the lead through the conversation when the wake names only the conversation", async () => {
        const { service, store } = await build(frozenFreezeOf())
        store.leadOfConversation.mockResolvedValue("lead-1")
        await expect(service.hold(CHAT_TURN, { conversationId: "c-7" })).resolves.toBe(true)
    })

    it("holds a bank transaction that pays an order of the frozen lead, and admits one of nobody frozen", async () => {
        const { service, store, records } = await build(frozenFreezeOf())
        const tag = agentTurnViewOf({ wakeId: "wake-tx", agentId: "accounting", source: "tag", context: {} })
        store.leadOfTransaction.mockResolvedValueOnce(frozenFreezeOf())

        await expect(service.hold(tag, { subject: { kind: "bank-transaction", id: "tx-1" } })).resolves.toBe(true)
        await expect(service.hold(tag, { subject: { kind: "bank-transaction", id: "tx-2" } })).resolves.toBe(false)

        expect(records.get("freeze-1")?.pending.map((each) => each.kind)).toEqual(["payment"])
        expect(store.leadOfTransaction).toHaveBeenCalledWith("ws-1", "tx-1", [
            expect.objectContaining({ id: "freeze-1" }),
        ])
    })

    it("holds a wake of the frozen workflow only: a wake of another workflow of the same customer starts its run", async () => {
        const { service, records } = await build(frozenFreezeOf({ key: "lead:lead-1|wf:wf-consult" }))
        const ofWorkflow = (workflowId: string) => ({ leadId: "lead-1", conversationId: "c-1", workflowId })

        await expect(service.hold(CHAT_TURN, ofWorkflow("wf-front-desk"))).resolves.toBe(false)
        expect(records.get("freeze-1")?.pending).toEqual([])

        await expect(service.hold(CHAT_TURN, ofWorkflow("wf-consult"))).resolves.toBe(true)
        expect(records.get("freeze-1")?.pending).toEqual([expect.objectContaining({ wakeId: "wake-9" })])
    })

    it("holds every workflow of a customer frozen as a whole (a freeze from before workflows were told apart)", async () => {
        const { service } = await build(frozenFreezeOf({ key: "lead:lead-1" }))

        await expect(
            service.hold(CHAT_TURN, { leadId: "lead-1", conversationId: "c-1", workflowId: "wf-front-desk" }),
        ).resolves.toBe(true)
    })

    it("holds a bank transaction only for a freeze of the workflow the credit wakes", async () => {
        const { service, store } = await build(frozenFreezeOf({ key: "lead:lead-1|wf:wf-consult" }))
        const tag = agentTurnViewOf({ wakeId: "wake-tx", agentId: "accounting", source: "tag", context: {} })
        const credit = { subject: { kind: "bank-transaction", id: "tx-1" }, workflowId: "wf-reconcile" }

        await expect(service.hold(tag, credit)).resolves.toBe(false)
        expect(store.leadOfTransaction).not.toHaveBeenCalled()
    })

    it("asks no transfer when nobody is frozen", async () => {
        const { service, store } = await build(null)
        await expect(service.hold(CHAT_TURN, { subject: "bank-transaction:tx-1" })).resolves.toBe(false)
        expect(store.leadOfTransaction).not.toHaveBeenCalled()
    })

    it("settles a retry that already ended well: the customer is released and this event replayed with the others", async () => {
        const { service, records, wakes } = await build(
            frozenFreezeOf({ status: "retrying", pending: [pendingLineOf()] }),
            "done",
        )

        await expect(service.hold(CHAT_TURN, { leadId: "lead-1" })).resolves.toBe(true)

        expect(records.get("freeze-1")).toMatchObject({
            status: "released",
            releaseReason: "retried",
            releasedBy: "retry",
        })
        expect(replayedOf(wakes)).toEqual(["wake-2", "wake-9"])
    })
})

describe("LeadFreezesService.frozen and waitingOf: what the engine asks without recording anything", () => {
    it("says whether the workflow a trigger names is frozen for its customer, and records no event", async () => {
        const { service, records, store } = await build(frozenFreezeOf({ key: "lead:lead-1|wf:wf-consult" }))
        const ofWorkflow = (workflowId: string) => ({ leadId: "lead-1", conversationId: "c-1", workflowId })

        await expect(service.frozen("ws-1", ofWorkflow("wf-consult"))).resolves.toBe(true)
        await expect(service.frozen("ws-1", ofWorkflow("wf-front-desk"))).resolves.toBe(false)
        await expect(service.frozen("ws-1", {})).resolves.toBe(false)

        expect(records.get("freeze-1")?.pending).toEqual([])
        expect(store.patch).not.toHaveBeenCalled()
    })

    it("lists what waits for the founder for the customer of a trigger, whatever the workflow that asks", async () => {
        const consult = frozenFreezeOf({ key: "lead:lead-1|wf:wf-consult" })
        const { service, records } = await build(consult)
        records.set(
            "freeze-2",
            frozenFreezeOf({ id: "freeze-2", key: "lead:lead-2|wf:wf-consult", leadId: "lead-2", conversationId: "c-2" }),
        )

        await expect(
            service.waitingOf("ws-1", { leadId: "lead-1", conversationId: "c-1", workflowId: "wf-front-desk" }),
        ).resolves.toEqual([{ step: "Take a payment claim", since: "2026-11-04T10:00:00.000Z" }])
        await expect(service.waitingOf("ws-1", { leadId: "lead-3" })).resolves.toEqual([])
        await expect(service.waitingOf("ws-1", {})).resolves.toEqual([])
    })

    it("finds what waits through the conversation of a customer who is not a lead yet, and names the step by its key when it has no title", async () => {
        const freeze = frozenFreezeOf({ key: "conversation:c-1|wf:wf-desk", leadId: null, stepTitle: null })
        const { service } = await build(freeze)

        await expect(service.waitingOf("ws-1", { conversationId: "c-1" })).resolves.toEqual([
            { step: "claim-ack", since: "2026-11-04T10:00:00.000Z" },
        ])
        await expect(service.waitingOf("ws-1", { conversationId: "c-9" })).resolves.toEqual([])
    })
})

describe("LeadFreezesService.stopped: a run that failed for good", () => {
    it("freezes the workflow the stopped run is pinned to, not the customer as a whole", async () => {
        const { service, records, runs } = await build()
        const pinned = stoppedRunOf()
        runs.stoppedOf.mockResolvedValue({
            ...pinned,
            failed: pinned.failed === null ? null : { ...pinned.failed, input: { ...FAILED.input, workflowId: "wf-consult" } },
        })

        await expect(service.stopped(STOP)).resolves.toBe(true)

        expect([...records.values()].map((freeze) => [freeze.key, freeze.status])).toEqual([
            ["lead:lead-1|wf:wf-consult", "frozen"],
        ])
        await expect(service.frozen("ws-1", { leadId: "lead-1", workflowId: "wf-reconcile" })).resolves.toBe(false)
    })

    it("freezes the lead of a graph run in a new episode, keeps the run for the owner and raises the one owner item", async () => {
        const { service, records, runs, items } = await build(null)

        await expect(service.stopped(STOP)).resolves.toBe(true)

        expect(records.get("freeze-1")).toMatchObject({
            key: "lead:lead-1",
            status: "frozen",
            frozenRunId: "run-1",
            agentId: "chatbot",
            frozenAt: "2026-11-04T10:05:00.000Z",
            frozenReason: "GRAPH_NODES_EXECUTOR_MISSING",
            stepKey: "claim-ack",
            stepTitle: "Take a payment claim",
            customerName: "Nguyen Van A",
            episode: 1,
            failures: 1,
            workItemId: "item-1",
            pending: [],
        })
        expect(runs.keep).toHaveBeenCalledWith("ws-1", "run-1")
        expect(items.raise).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "freeze-1" }), "vi")
    })

    it("answers the same for a run told twice, without a second failure", async () => {
        const { service, records } = await build(null)
        await service.stopped(STOP)
        await expect(service.stopped(STOP)).resolves.toBe(true)
        expect(records.get("freeze-1")?.failures).toBe(1)
    })

    it("counts a retry that failed again and freezes the customer again, in the same episode", async () => {
        const { service, records } = await build(frozenFreezeOf({ status: "retrying" }))
        await expect(service.stopped(STOP)).resolves.toBe(true)
        expect(records.get("freeze-1")).toMatchObject({ status: "frozen", failures: 2, episode: 1 })
    })

    it("starts a new episode for a customer released before, with nothing of the last one left", async () => {
        const released = frozenFreezeOf({
            status: "released",
            pending: [pendingLineOf()],
            heldBy: "Owner",
            releaseReason: "skipped",
        })
        const { service, records } = await build(released)
        await service.stopped(STOP)
        expect(records.get("freeze-1")).toMatchObject({
            status: "frozen",
            episode: 2,
            failures: 1,
            pending: [],
            heldBy: null,
            releaseReason: null,
        })
    })
})

describe("LeadFreezesService.stopped: who a stopped run freezes", () => {
    it("keeps another run of a customer already frozen for the owner, and the freeze keeps its own run and item", async () => {
        const { service, records, runs, items, logger } = await build(frozenFreezeOf({ frozenRunId: "run-0" }))
        await expect(service.stopped(STOP)).resolves.toBe(false)
        expect(records.get("freeze-1")?.frozenRunId).toBe("run-0")
        expect(runs.keep).toHaveBeenCalledWith("ws-1", "run-1")
        expect(items.raise).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(LeadFreezesLogEvent.OtherRunStopped, {
            freezeId: "freeze-1",
            runId: "run-1",
        })
    })

    it("freezes nothing for a run that is gone, has no failed step, is not a graph run or names no customer", async () => {
        const { service, runs } = await build(null)
        runs.stoppedOf
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(stoppedRunOf({ failed: null }))
            .mockResolvedValueOnce(stoppedRunOf({ failed: { ...FAILED, nodeStep: false } }))
            .mockResolvedValueOnce(stoppedRunOf({ failed: { ...FAILED, input: {} }, context: {} }))
        await expect(service.stopped(STOP)).resolves.toBe(false)
        await expect(service.stopped(STOP)).resolves.toBe(false)
        await expect(service.stopped(STOP)).resolves.toBe(false)
        await expect(service.stopped(STOP)).resolves.toBe(false)
    })

    it("freezes the conversation of a customer who is not a lead yet, and the lead of a conversation that has one", async () => {
        const trigger = { conversationId: "c-7" }
        const first = await build(null)
        await first.service.stopped({ ...STOP, trigger })
        expect(first.records.get("freeze-1")).toMatchObject({
            key: "conversation:c-7",
            leadId: null,
            conversationId: "c-7",
        })
        expect(first.store.nameOfLead).not.toHaveBeenCalled()

        const second = await build(null)
        second.store.leadOfConversation.mockResolvedValue("lead-7")
        await second.service.stopped({ ...STOP, trigger })
        expect(second.records.get("freeze-1")).toMatchObject({
            key: "lead:lead-7",
            leadId: "lead-7",
            conversationId: "c-7",
        })
    })
})

describe("LeadFreezesService.retry", () => {
    it("runs the failed run again with the lines of its conversation folded in, and releases the customer when it ends well", async () => {
        const { service, records, runs, runState, wakes } = await build(
            frozenFreezeOf({ pending: [pendingLineOf(), pendingPaymentOf()] }),
        )
        runs.retry.mockImplementationOnce(() => {
            runState.status = "done"
            return Promise.resolve(RESUMED)
        })

        await expect(service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("released")

        expect(runs.retry).toHaveBeenCalledWith("ws-1", "run-1", "owner-1", ["m-2"])
        expect(records.get("freeze-1")).toMatchObject({
            status: "released",
            releaseReason: "retried",
            releasedBy: "owner-1",
        })
        expect(replayedOf(wakes)).toEqual(["wake-3"])
    })

    it("retries a step that never reads the customer's words as it was, and replays their lines after the release", async () => {
        const { service, runs, runState, wakes } = await build(
            frozenFreezeOf({ pending: [pendingLineOf(), pendingPaymentOf()] }),
        )
        runs.readsCustomerWords.mockResolvedValueOnce(false)
        runs.retry.mockImplementationOnce(() => {
            runState.status = "done"
            return Promise.resolve(RESUMED)
        })

        await expect(service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("released")

        expect(runs.retry).toHaveBeenCalledWith("ws-1", "run-1", "owner-1", [])
        expect(replayedOf(wakes)).toHaveLength(2)
    })

    it("keeps the customer frozen when the retry failed again, and retrying while the run goes on", async () => {
        const failed = await build(frozenFreezeOf(), "parked")
        await expect(failed.service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("still_frozen")
        expect(failed.records.get("freeze-1")?.status).toBe("frozen")

        const running = await build(frozenFreezeOf(), "waiting")
        await expect(running.service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("retrying")
        expect(running.records.get("freeze-1")?.status).toBe("retrying")
        await expect(running.service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("retrying")
        expect(running.runs.retry).toHaveBeenCalledTimes(1)
    })

    it("answers a step whose outcome is unknown as one that cannot run again", async () => {
        const { service, runs } = await build(frozenFreezeOf(), "parked")
        runs.retry.mockResolvedValueOnce({ resume: { kind: "outcome_unknown" }, status: "parked" })
        await expect(service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("not_retryable")
    })

    it("releases at once a customer whose run already ended well another way, and answers nothing for one not frozen", async () => {
        const done = await build(frozenFreezeOf(), "done")
        await expect(done.service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("released")
        expect(done.runs.retry).not.toHaveBeenCalled()

        const none = await build(releasedFreezeOf())
        await expect(none.service.retry("ws-1", "freeze-1", "owner-1")).resolves.toBe("not_frozen")
        await expect(none.service.retry("ws-1", "nope", "owner-1")).resolves.toBe("not_frozen")
    })
})

describe("LeadFreezesService.skip and takeOver", () => {
    it("skipping gives the run up, releases the customer and replays every event, the folded lines too", async () => {
        const { service, records, runs, wakes } = await build(
            frozenFreezeOf({ pending: [pendingLineOf({ folded: true }), pendingPaymentOf()] }),
        )

        await expect(service.skip("ws-1", "freeze-1", "owner-1")).resolves.toBe("skipped")

        expect(runs.abandon).toHaveBeenCalledWith("ws-1", "run-1", "owner-1")
        expect(records.get("freeze-1")).toMatchObject({ status: "released", releaseReason: "skipped" })
        expect(replayedOf(wakes)).toEqual(["wake-2", "wake-3"])
        await expect(service.skip("ws-1", "freeze-1", "owner-1")).resolves.toBe("not_frozen")
    })

    it("taking over hands the conversation to the person and keeps the customer frozen", async () => {
        const { service, records, wakes } = await build(frozenFreezeOf())

        await expect(service.takeOver("ws-1", "freeze-1", "Owner")).resolves.toBe("taken_over")

        expect(wakes.takeOver).toHaveBeenCalledWith("ws-1", "c-1", "Owner")
        expect(records.get("freeze-1")).toMatchObject({ status: "frozen", heldBy: "Owner" })
        await expect((await build(releasedFreezeOf())).service.takeOver("ws-1", "freeze-1", "x")).resolves.toBe(
            "not_frozen",
        )
    })
})

describe("LeadFreezesService state and items", () => {
    it("answers the state of a lead, of a run and of a freeze, settling a retry that already ended", async () => {
        const frozen = await build(frozenFreezeOf())
        await expect(frozen.service.stateOfLead("ws-1", "lead-1")).resolves.toMatchObject({
            id: "freeze-1",
            status: "frozen",
        })
        await expect(frozen.service.stateOfRun("ws-1", "run-1")).resolves.toMatchObject({ runId: "run-1" })
        await expect(frozen.service.stateOf("ws-1", "freeze-1")).resolves.toMatchObject({
            stepTitle: "Take a payment claim",
        })
        await expect(frozen.service.stateOfLead("ws-1", "lead-x")).resolves.toBeNull()

        const ended = await build(frozenFreezeOf({ status: "retrying" }), "done")
        await expect(ended.service.stateOfLead("ws-1", "lead-1")).resolves.toBeNull()
    })

    it("raises the next item of a freeze that still holds its customer, and none for one released", async () => {
        const { service, items } = await build(frozenFreezeOf())
        await service.reraise("ws-1", "freeze-1")
        expect(items.raise).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "freeze-1" }), "vi")

        const released = await build(releasedFreezeOf())
        await released.service.reraise("ws-1", "freeze-1")
        expect(released.items.raise).not.toHaveBeenCalled()
    })
})

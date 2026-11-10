import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { ThreadRunsService, ThreadSweepService } from "@modules/domain/agent-threads"
import type { ThreadSettledListener, ThreadSweepRider } from "@modules/domain/agent-threads"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { frozenFreezeOf, pendingLineOf, releasedFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import type { FreezeBuild } from "./lead-freeze-records.service"
import { LeadFreezeStopHoldsService } from "./lead-freeze-stop-holds.service"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"
import type { StopCustomer } from "./lead-freeze-stops.service"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeSubject, HeldStop, LeadFreeze } from "./lead-freezes.contracts"



/** Where the run of a freeze stands, as a spec moves it. */
interface RunState {
    status: RunView["status"] | null
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

const build = async (initial: LeadFreeze | null = null, status: RunView["status"] | null = "parked") => {
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
    const runState: RunState = { status }
    // The runs as the stop holds read them: where a run stands, and the run a wake tried again already opened.
    const runs = mock<AgentRunsService>({
        runOf: jest.fn((_ws: string, runId: string) =>
            Promise.resolve(runState.status === null ? null : runViewOf({ id: runId, status: runState.status })),
        ),
        runIdOfWake: jest.fn().mockResolvedValue(null),
    })
    // The open stops of thread runs, as a spec opens and closes them.
    const openStops: Array<HeldStop> = []
    const stops = mock<LeadFreezeStopsService>({
        openOfCustomer: jest.fn((_ws: string, customer: StopCustomer) =>
            Promise.resolve(
                openStops.filter(
                    (stop) =>
                        (customer.leadId !== null && stop.leadId === customer.leadId) ||
                        (customer.conversationId !== null && stop.conversationId === customer.conversationId),
                ),
            ),
        ),
        openOfRun: jest.fn((_ws: string, runId: string) =>
            Promise.resolve(openStops.filter((stop) => stop.runId === runId)),
        ),
    })
    const wakes = mock<LeadFreezeWakesService>({ replay: jest.fn().mockResolvedValue(1) })
    const gate = mock<AgentGraphFreezeGateService>()
    // The hooks of the thread runs and of the thread sweep, as the stop holds register on them.
    const settled: Array<ThreadSettledListener> = []
    const riders: Array<ThreadSweepRider> = []
    const threadRuns = mock<ThreadRunsService>({ whenSettled: jest.fn((listener: ThreadSettledListener) => settled.push(listener)) })
    const sweep = mock<ThreadSweepService>({ alsoPerWorkspace: jest.fn((rider: ThreadSweepRider) => riders.push(rider)) })
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
            { provide: AgentRunsService, useValue: runs },
            { provide: LeadFreezeWakesService, useValue: wakes },
            { provide: LeadFreezeStopsService, useValue: stops },
            { provide: ThreadRunsService, useValue: threadRuns },
            { provide: ThreadSweepService, useValue: sweep },
            LeadFreezeStopHoldsService,
        ],
    }).compile()
    return {
        service: moduleRef.get(LeadFreezesService),
        holds: moduleRef.get(LeadFreezeStopHoldsService),
        settled,
        riders,
        records,
        store,
        runs,
        runState,
        wakes,
        gate,
        logger,
        openStops,
        stops,
    }
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

/** An open stop of thread run run-7 of the front desk, about lead-1 in conversation c-1. */
const OPEN_STOP: HeldStop = {
    runId: "run-7",
    stepKey: "consult",
    agentId: "chatbot",
    workflowId: "wf-front-desk",
    leadId: "lead-1",
    conversationId: "c-1",
    stoppedAt: "2026-11-04T10:00:00.000Z",
}

/** A line of lead-1 to the front desk, as the flow asks `hold` before it opens a run. */
const FRONT_DESK = { leadId: "lead-1", conversationId: "c-1", workflowId: "wf-front-desk", messageIds: ["m-9"] }

const turnOf = (wakeId: string, attempts = 1) =>
    agentTurnViewOf({ wakeId, agentId: "chatbot", source: "customer", context: { conversationId: "c-1" }, attempts })

/** The hold of run-7's stop, after it held one line. */
const threadHoldOf = (overrides: Partial<LeadFreeze> = {}): LeadFreeze =>
    frozenFreezeOf({
        id: "freeze-7",
        key: "lead:lead-1|wf:wf-front-desk",
        frozenRunId: "run-7",
        frozenReason: "run_stop",
        stepKey: "consult",
        stepTitle: null,
        workItemId: null,
        pending: [pendingLineOf()],
        ...overrides,
    })

describe("LeadFreezeStopHoldsService registration", () => {
    it("registers on the thread runs (after every drive) and on the thread sweep (per workspace), which then settle the holds", async () => {
        const { holds, settled, riders, store, records, wakes } = await build(threadHoldOf(), "waiting")
        holds.onModuleInit()
        expect(settled).toHaveLength(1)
        expect(riders).toHaveLength(1)

        await settled[0]?.({ workspaceId: "ws-1", runId: "run-7" })
        expect(store.byRun).toHaveBeenCalledWith("ws-1", "run-7")
        expect(records.get("freeze-7")?.status).toBe("released")

        records.set("freeze-8", threadHoldOf({ id: "freeze-8", key: "lead:lead-2|wf:wf-front-desk", leadId: "lead-2" }))
        await riders[0]?.("ws-1")
        expect(records.get("freeze-8")?.status).toBe("released")
        expect(wakes.replay).toHaveBeenCalledTimes(2)
    })

})

describe("LeadFreezesService: a thread run's stop holds the customer's new wakes", () => {
    it("holds a new wake of the same customer and workflow while the stop is open: recorded once, no owner item", async () => {
        const { service, records, logger, openStops } = await build(null, "waiting")
        openStops.push(OPEN_STOP)

        await expect(service.hold(CHAT_TURN, FRONT_DESK)).resolves.toBe(true)
        await expect(service.hold(CHAT_TURN, FRONT_DESK)).resolves.toBe(true)

        expect([...records.values()]).toEqual([
            expect.objectContaining({
                key: "lead:lead-1|wf:wf-front-desk",
                status: "frozen",
                frozenRunId: "run-7",
                frozenReason: "run_stop",
                stepKey: "consult",
                workItemId: null,
                customerName: "Nguyen Van A",
                episode: 1,
                pending: [expect.objectContaining({ wakeId: "wake-9", kind: "message", messageIds: ["m-9"] })],
            }),
        ])
        expect(logger.info).toHaveBeenCalledWith(
            LeadFreezesLogEvent.HeldForStop,
            expect.objectContaining({ runId: "run-7", stepKey: "consult", wakeId: "wake-9" }),
        )
    })

    it("serves a wake of another workflow, of another customer, and of a customer whose only stop is bank-fed", async () => {
        const { service, records, openStops } = await build(null, "waiting")
        const bankFed = { ...OPEN_STOP, runId: "run-bank", leadId: null, conversationId: null, workflowId: "wf-reconcile" }
        openStops.push(OPEN_STOP, bankFed)

        await expect(service.hold(CHAT_TURN, { ...FRONT_DESK, workflowId: "wf-consult" })).resolves.toBe(false)
        await expect(service.hold(CHAT_TURN, { leadId: "lead-2", workflowId: "wf-front-desk" })).resolves.toBe(false)
        const credit = { subject: "bank-transaction:tx-1", workflowId: "wf-reconcile" }
        await expect(service.hold(CHAT_TURN, credit)).resolves.toBe(false)

        expect(records.size).toBe(0)
    })

    it("never holds the wake that opened the stopped run when it is tried again, before or after the hold exists", async () => {
        const { service, runs, openStops } = await build(null, "waiting")
        openStops.push(OPEN_STOP)
        runs.runIdOfWake.mockResolvedValue("run-7")

        await expect(service.hold(turnOf("wake-1", 2), FRONT_DESK)).resolves.toBe(false)
        await expect(service.hold(turnOf("wake-9"), FRONT_DESK)).resolves.toBe(true)
        await expect(service.hold(turnOf("wake-1", 2), FRONT_DESK)).resolves.toBe(false)
        expect(runs.runIdOfWake).toHaveBeenCalledWith("ws-1", "wake-1")
    })

    it("holds nobody for a stop whose run is over", async () => {
        const { service, openStops } = await build(null, "failed")
        openStops.push(OPEN_STOP)
        await expect(service.hold(CHAT_TURN, FRONT_DESK)).resolves.toBe(false)
    })

    it("tells the engine the workflow waits and what waits, without recording anything", async () => {
        const { service, records, openStops } = await build(null, "waiting")
        openStops.push(OPEN_STOP)

        await expect(service.frozen("ws-1", FRONT_DESK)).resolves.toBe(true)
        await expect(service.frozen("ws-1", { ...FRONT_DESK, workflowId: "wf-consult" })).resolves.toBe(false)
        await expect(service.waitingOf("ws-1", { ...FRONT_DESK, workflowId: "wf-consult" })).resolves.toEqual([
            { step: "consult", since: "2026-11-04T10:00:00.000Z" },
        ])
        expect(records.size).toBe(0)
    })
})

describe("LeadFreezesService: the hold of a stop is released when the stop closes", () => {
    it("replays the held events once, in the order they came, when the drive that closed the stop settles", async () => {
        const { service, holds, records, wakes, openStops } = await build(null, "waiting")
        openStops.push(OPEN_STOP)
        await service.hold(turnOf("wake-9"), FRONT_DESK)
        await service.hold(turnOf("wake-10"), { ...FRONT_DESK, messageIds: ["m-10"] })

        openStops.length = 0
        await holds.threadSettled("ws-1", "run-7")
        await holds.threadSettled("ws-1", "run-7")

        expect(records.get("freeze-1")).toMatchObject({
            status: "released",
            releaseReason: "stop_closed",
            releasedBy: "engine",
        })
        expect(wakes.replay).toHaveBeenCalledTimes(1)
        expect(replayedOf(wakes)).toEqual(["wake-9", "wake-10"])
        await expect(service.hold(turnOf("wake-11"), FRONT_DESK)).resolves.toBe(false)
    })

    it("keeps holding while the stop is still open, and follows the run when it stops again at another step", async () => {
        const { holds, records, wakes, openStops } = await build(threadHoldOf(), "waiting")
        openStops.push(OPEN_STOP)

        await holds.threadSettled("ws-1", "run-7")
        expect(records.get("freeze-7")).toMatchObject({ status: "frozen", stepKey: "consult" })

        openStops.splice(0, 1, { ...OPEN_STOP, stepKey: "match" })
        await holds.threadSettled("ws-1", "run-7")

        expect(records.get("freeze-7")).toMatchObject({ status: "frozen", stepKey: "match" })
        expect(wakes.replay).not.toHaveBeenCalled()
    })

    it("releases on the customer's next wake when no settle ran: that wake is replayed after the ones held before it", async () => {
        const { service, records, wakes } = await build(threadHoldOf(), "waiting")

        await expect(service.hold(CHAT_TURN, FRONT_DESK)).resolves.toBe(true)

        expect(records.get("freeze-7")).toMatchObject({ status: "released", releaseReason: "stop_closed" })
        expect(replayedOf(wakes)).toEqual(["wake-2", "wake-9"])
    })

    it("releases the hold of a run that is over, even with a stop left open on it", async () => {
        const { holds, records, openStops } = await build(threadHoldOf(), "failed")
        openStops.push(OPEN_STOP)
        await holds.threadSettled("ws-1", "run-7")
        expect(records.get("freeze-7")?.status).toBe("released")
    })

    it("settles every hold of a closed stop in the workspace and leaves the freezes of the old engine alone (the sweep)", async () => {
        const { holds, records, wakes } = await build(frozenFreezeOf(), "waiting")
        records.set("freeze-7", threadHoldOf())

        await expect(holds.settleThreads("ws-1")).resolves.toBe(1)

        expect(records.get("freeze-7")?.status).toBe("released")
        expect(records.get("freeze-1")?.status).toBe("frozen")
        expect(wakes.replay).toHaveBeenCalledTimes(1)
    })

    it("logs a settle that failed and never fails the drive", async () => {
        const { holds, store, logger } = await build(threadHoldOf(), "waiting")
        store.byRun.mockRejectedValueOnce(new Error("db down"))
        await expect(holds.threadSettled("ws-1", "run-7")).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(LeadFreezesLogEvent.SettleFailed, expect.any(Error), { runId: "run-7" })
    })
})

describe("LeadFreezesService: the founder answers the stop, never the hold", () => {
    it("reads a hold whose stop is open as on_stop, with no item, and moves nothing", async () => {
        const { service, records, wakes, openStops } = await build(threadHoldOf(), "waiting")
        openStops.push(OPEN_STOP)

        await expect(service.stateOf("ws-1", "freeze-7")).resolves.toMatchObject({ onStop: true })
        expect(wakes.replay).not.toHaveBeenCalled()
        expect(records.get("freeze-7")).toMatchObject({ status: "frozen", heldBy: null })
        await expect(service.stateOfRun("ws-1", "run-7")).resolves.toMatchObject({ onStop: true, workItemId: null })
    })

    it("reads a hold whose stop closed as released, replaying its events", async () => {
        const { service, wakes } = await build(threadHoldOf(), "waiting")
        await expect(service.stateOfLead("ws-1", "lead-1")).resolves.toBeNull()
        expect(replayedOf(wakes)).toEqual(["wake-2"])
    })
})

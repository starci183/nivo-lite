import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import {
    AgentTagService,
    AgentTasksService,
    AgentTriggersService,
    AgentTurnsService,
    AgentWakeRetentionService,
    AgentWakeService,
} from "@modules/domain/agent-work"
import type { AgentTriggerRecord, AgentWorkDue } from "@modules/domain/agent-work"
import { ThreadSweepService } from "@modules/domain/agent-threads"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENT_TURN_QUEUE_PRODUCER, AgentTurnQueue } from "@modules/queues/agent-turn"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { AgentWorkSweepService } from "./agent-work-sweep.service"

const NOW = "2026-11-10T03:10:00.000Z"
const MINUTES = (ago: number): Date => new Date(new Date(NOW).getTime() - ago * 60_000)
const NEXT = new Date("2026-11-10T04:06:00.000Z")

const due = (over: Partial<AgentWorkDue> = {}): AgentWorkDue => ({
    kind: "wake",
    agentId: "agent-1",
    workspaceId: "ws-1",
    scopeKey: "agent",
    subjectId: null,
    at: MINUTES(5),
    ...over,
})

const record = (over: Partial<AgentTriggerRecord> = {}): AgentTriggerRecord => ({
    id: "trigger-1",
    agentId: "agent-1",
    kind: "schedule",
    preset: "hourly",
    atTime: null,
    timeZone: "Asia/Ho_Chi_Minh",
    eventName: null,
    probeKey: "invoices_due",
    enabled: true,
    seedKey: null,
    nextRunAt: null,
    lastFiredAt: null,
    ...over,
})

const build = async (
    items: ReadonlyArray<AgentWorkDue>,
    trigger: AgentTriggerRecord | null = record(),
    threads = true,
) => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = jobRecordingOutbox()
    const real = new AgentTurnQueue(outbox)
    const queue = mock<AgentTurnQueue>({ enqueueSweepDrain: jest.fn(real.enqueueSweepDrain.bind(real)) })
    const turns = mock<AgentTurnsService>({ due: jest.fn().mockResolvedValue(items) })
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const tasks = mock<AgentTasksService>({
        markWoken: jest.fn().mockResolvedValue(undefined),
        byId: jest.fn().mockResolvedValue(null),
    })
    const tags = mock<AgentTagService>({ tagAgent: jest.fn().mockResolvedValue({ tagged: true, wakeId: "wake-1" }) })
    const triggers = mock<AgentTriggersService>({
        byId: jest.fn().mockResolvedValue(trigger),
        recordFire: jest.fn().mockResolvedValue(undefined),
    })
    const retention = mock<AgentWakeRetentionService>({ sweep: jest.fn().mockResolvedValue(3) })
    const sync = mock<AgentTriggerSyncService>({ reconcile: jest.fn().mockResolvedValue(NEXT) })
    const logger = mock<Logger>()
    const threadSweep = mock<ThreadSweepService>({
        sweep: jest.fn().mockResolvedValue({ redriven: 0, repaired: 0, abandoned: 0, closed: 0, fired: 0 }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkSweepService,
            ...(threads ? [{ provide: ThreadSweepService, useValue: threadSweep }] : []),
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: AgentTurnsService, useValue: turns },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentTasksService, useValue: tasks },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentWakeRetentionService, useValue: retention },
            { provide: AgentTriggerSyncService, useValue: sync },
            { provide: AgentTagService, useValue: tags },
        ],
    }).compile()
    return {
        service: container.get(AgentWorkSweepService),
        turns,
        wakes,
        tasks,
        tags,
        triggers,
        retention,
        sync,
        threadSweep,
        queue,
        outbox,
        logger,
        tx,
    }
}

describe("AgentWorkSweepService.sweep, scopes to drain", () => {
    it("starts a drain for a due wake and for a lapsed lease, one per scope and minute", async () => {
        const { service, queue, turns } = await build([
            due(),
            due({ kind: "lease", scopeKey: "conversation:conv-1", subjectId: "turn-1" }),
        ])

        await expect(service.sweep()).resolves.toMatchObject({ drains: 2 })

        expect(turns.due).toHaveBeenCalledWith(200)
        expect(queue.enqueueSweepDrain.mock.calls.map(([scope]) => scope)).toEqual([
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "agent" },
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
        ])
    })
})

describe("AgentWorkSweepService.sweep, the drain job it writes", () => {
    it("writes the sweep drain job of a stuck scope in a transaction, keyed by the scope and the minute", async () => {
        const { service, outbox } = await build([due({ scopeKey: "conversation:conv-1" })])

        await service.sweep()

        expect(outbox.written).toEqual([
            {
                queue: "agent_turn",
                payload: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
                job: "agent-turn.drain",
                dedupeKey: "agent-turn:agent-1:sweep:conversation:conv-1:29904670",
            },
        ])
        expect(outbox.inTransaction).toBe(true)
    })
})

describe("AgentWorkSweepService.sweep, tasks", () => {
    it("writes one internal wake for a task that fell due and clears the time it answered, in one transaction", async () => {
        const at = MINUTES(3)
        const { service, wakes, tasks, tx } = await build([due({ kind: "task", subjectId: "task-1", at })])

        await expect(service.sweep()).resolves.toMatchObject({ tasks: 1 })

        expect(wakes.wake).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "internal",
            eventKey: `task:task-1:${String(at.getTime())}`,
            context: { taskId: "task-1", subjectId: "task-1" },
            actorMemberId: null,
        })
        expect(tasks.markWoken).toHaveBeenCalledWith(expect.anything(), "task-1", at)
        expect(tx.commits).toBe(1)
    })

    it("wakes the Sales agent with a tag for a care step that fell due, naming the step, the record and the real moment, and clears the time", async () => {
        const at = MINUTES(3)
        const { service, wakes, tasks, tags, tx } = await build([due({ kind: "task", subjectId: "task-9", at })])
        tasks.byId.mockResolvedValue({
            id: "task-9",
            agentId: "agent-1",
            goalId: null,
            dedupeKey: "care:occasion:lead-1:birthday-2-1",
            title: "care due 2027-01-25T17:00:00.000Z",
            detail: "",
            status: "open",
            waitingOn: null,
            nextActionAt: at,
            workItemId: null,
        })

        await expect(service.sweep()).resolves.toMatchObject({ tasks: 1 })

        expect(tags.tagAgent).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                toAgentId: "agent-1",
                source: "care-timer",
                text: "care.due occasion",
                subject: "lead:lead-1",
                leadId: "lead-1",
                eventKey: `care:task-9:${String(at.getTime())}`,
                context: {
                    event: "care.due",
                    careKind: "occasion",
                    ref: "lead-1",
                    suffix: "birthday-2-1",
                    dueAt: "2027-01-25T17:00:00.000Z",
                },
            },
            expect.anything(),
        )
        expect(tasks.markWoken).toHaveBeenCalledWith(expect.anything(), "task-9", at)
        expect(wakes.wake).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("subjects the tag of an order step to the order and gives it no customer", async () => {
        const at = MINUTES(1)
        const { service, tasks, tags } = await build([due({ kind: "task", subjectId: "task-8", at })])
        tasks.byId.mockResolvedValue({
            id: "task-8",
            agentId: "agent-1",
            goalId: null,
            dedupeKey: "care:payment-reminder:o1",
            title: "care due 2026-11-10T03:00:00.000Z",
            detail: "",
            status: "open",
            waitingOn: null,
            nextActionAt: at,
            workItemId: null,
        })

        await service.sweep()

        expect(tags.tagAgent.mock.calls[0]?.[0]).toMatchObject({ subject: "order:o1", context: { careKind: "payment-reminder", suffix: "" } })
        expect(tags.tagAgent.mock.calls[0]?.[0]).not.toHaveProperty("leadId")
    })

    it("leaves a task row with no id or no time alone", async () => {
        const { service, wakes } = await build([
            due({ kind: "task", subjectId: null }),
            due({ kind: "task", subjectId: "task-1", at: null }),
        ])

        await expect(service.sweep()).resolves.toMatchObject({ tasks: 0 })

        expect(wakes.wake).not.toHaveBeenCalled()
    })
})

describe("AgentWorkSweepService.sweep, triggers", () => {
    it("makes the scheduler true to its row and writes nothing for a slot that is not late", async () => {
        const { service, sync, wakes } = await build([due({ kind: "trigger", subjectId: "trigger-1", at: null })])

        await expect(service.sweep()).resolves.toMatchObject({ triggers: 1, missed: 0 })

        expect(sync.reconcile).toHaveBeenCalledWith("ws-1", record())
        expect(wakes.wake).not.toHaveBeenCalled()
    })

    it("writes one wake for a missed slot, the latest only, and records it as fired", async () => {
        const missed = MINUTES(10)
        const next = new Date("2026-11-10T04:00:00.000Z")
        const { service, wakes, triggers, sync } = await build([
            due({ kind: "trigger", subjectId: "trigger-1", at: missed }),
        ])
        sync.reconcile.mockResolvedValue(next)

        await expect(service.sweep()).resolves.toMatchObject({ triggers: 1, missed: 1 })

        expect(wakes.wake).toHaveBeenCalledTimes(1)
        expect(wakes.wake).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                source: "schedule",
                eventKey: `trigger-1:${String(missed.getTime())}`,
                context: { triggerId: "trigger-1", slot: String(missed.getTime()), probeKey: "invoices_due" },
            }),
        )
        expect(triggers.recordFire).toHaveBeenCalledWith(expect.anything(), "trigger-1", missed, next)
    })

    it("takes the slot just before the next one when the scheduler was lost for a long time", async () => {
        const { service, wakes } = await build(
            [due({ kind: "trigger", subjectId: "trigger-1", at: new Date("2026-11-07T03:06:00.000Z") })],
            record({ probeKey: null }),
        )

        await service.sweep()

        const latest = NEXT.getTime() - 3_600_000
        expect(wakes.wake).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                eventKey: `trigger-1:${String(latest)}`,
                context: { triggerId: "trigger-1", slot: String(latest) },
            }),
        )
    })

    it("writes no wake when the trigger has no scheduler any more, for it is off or its work is switched off", async () => {
        const { service, wakes, sync } = await build([
            due({ kind: "trigger", subjectId: "trigger-1", at: MINUTES(10) }),
        ])
        sync.reconcile.mockResolvedValue(null)

        await expect(service.sweep()).resolves.toMatchObject({ triggers: 1, missed: 0 })

        expect(wakes.wake).not.toHaveBeenCalled()
    })

    it("skips a trigger row that is gone or has no id, and one that has no preset", async () => {
        const gone = await build([due({ kind: "trigger", subjectId: "trigger-1" })], null)
        const noId = await build([due({ kind: "trigger", subjectId: null })])
        const noPreset = await build(
            [due({ kind: "trigger", subjectId: "trigger-1", at: MINUTES(10) })],
            record({ preset: null }),
        )

        await expect(gone.service.sweep()).resolves.toMatchObject({ triggers: 0 })
        await expect(noId.service.sweep()).resolves.toMatchObject({ triggers: 0 })
        await expect(noPreset.service.sweep()).resolves.toMatchObject({ triggers: 1, missed: 0 })
        expect(gone.sync.reconcile).not.toHaveBeenCalled()
        expect(noPreset.wakes.wake).not.toHaveBeenCalled()
    })
})

describe("AgentWorkSweepService.sweep, retention and failures", () => {
    it("removes the wakes past retention in a bounded batch and reports the pass", async () => {
        const { service, retention, logger } = await build([])

        await expect(service.sweep()).resolves.toEqual({ drains: 0, tasks: 0, triggers: 0, missed: 0, removed: 3 })

        expect(retention.sweep).toHaveBeenCalledWith(500)
        expect(logger.info).toHaveBeenCalledWith(AgentSchedulesLogEvent.SweepDone, {
            drains: 0,
            tasks: 0,
            triggers: 0,
            missed: 0,
            removed: 3,
        })
    })

    it("logs an item that fails and goes on with the rest of the pass", async () => {
        const { service, wakes, logger } = await build([
            due({ kind: "task", subjectId: "task-1", at: MINUTES(3) }),
            due({ kind: "task", subjectId: "task-2", at: MINUTES(2) }),
        ])
        wakes.wake.mockRejectedValueOnce(new Error("db down"))

        await expect(service.sweep()).resolves.toMatchObject({ tasks: 1 })

        expect(logger.error).toHaveBeenCalledWith(AgentSchedulesLogEvent.SweepItemFailed, expect.any(Error), {
            kind: "task",
            agentId: "agent-1",
            subjectId: "task-1",
        })
        expect(wakes.wake).toHaveBeenCalledTimes(2)
    })
})

describe("AgentWorkSweepService.sweep, thread runs", () => {
    it("sweeps the thread runs in the same pass; a failing thread sweep does not stop the work sweep", async () => {
        const { service, threadSweep, logger } = await build([])

        threadSweep.sweep.mockRejectedValueOnce(new Error("db down"))
        await expect(service.sweep()).resolves.toMatchObject({ drains: 0 })
        await service.sweep()

        expect(threadSweep.sweep).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledWith(AgentSchedulesLogEvent.SweepItemFailed, expect.any(Error), {
            kind: "threads",
        })
    })

    it("runs as before in an app that composes no thread runs", async () => {
        const { service, threadSweep } = await build([], record(), false)

        await expect(service.sweep()).resolves.toMatchObject({ drains: 0 })
        expect(threadSweep.sweep).not.toHaveBeenCalled()
    })
})

describe("AgentWorkSweepService.runTaskNow (the schedule list's \"run now\")", () => {
    const AT = new Date("2026-11-12T02:00:00.000Z")
    const PRESS = { memberId: "member-owner", at: new Date(NOW) }
    const careTask = (over: Record<string, unknown> = {}) => ({
        id: "task-7",
        agentId: "agent-1",
        goalId: null,
        dedupeKey: "care:delivery-check:o7",
        title: "care due 2026-11-12T02:00:00.000Z",
        detail: "",
        status: "open" as const,
        waitingOn: null,
        nextActionAt: AT,
        workItemId: null,
        ...over,
    })
    const item = { ...due({ kind: "task", subjectId: "task-7", at: AT }), scopeKey: "agent" }

    it("writes the SAME care tag the timer writes (same key), now: the moment is now and names who pressed; the time is cleared", async () => {
        const { service, tasks, tags, wakes, tx } = await build([])
        tasks.byId.mockResolvedValue(careTask())

        await expect(service.runTaskNow(item, PRESS)).resolves.toBe("woken")

        expect(tags.tagAgent).toHaveBeenCalledWith(
            expect.objectContaining({
                source: "care-timer",
                eventKey: `care:task-7:${String(AT.getTime())}`,
                context: {
                    event: "care.due",
                    careKind: "delivery-check",
                    ref: "o7",
                    suffix: "",
                    dueAt: NOW,
                    runNowBy: "member-owner",
                },
            }),
            expect.anything(),
        )
        expect(tasks.markWoken).toHaveBeenCalledWith(expect.anything(), "task-7", AT)
        expect(wakes.wake).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("answers already_ran when the wake of that time was written already (the timer fired, or someone pressed first)", async () => {
        const { service, tasks, tags } = await build([])
        tasks.byId.mockResolvedValue(careTask())
        tags.tagAgent.mockResolvedValue({ tagged: false, reason: "duplicate" })

        await expect(service.runTaskNow(item, PRESS)).resolves.toBe("already_ran")
    })

    it("writes nothing for a task closed, woken or moved to another time since the list was read", async () => {
        const closed = await build([])
        closed.tasks.byId.mockResolvedValue(careTask({ status: "done" }))
        const woken = await build([])
        woken.tasks.byId.mockResolvedValue(careTask({ nextActionAt: null }))
        const moved = await build([])
        moved.tasks.byId.mockResolvedValue(careTask({ nextActionAt: new Date("2026-11-13T02:00:00.000Z") }))

        await expect(closed.service.runTaskNow(item, PRESS)).resolves.toBe("already_ran")
        await expect(woken.service.runTaskNow(item, PRESS)).resolves.toBe("already_ran")
        await expect(moved.service.runTaskNow(item, PRESS)).resolves.toBe("already_ran")
        expect([closed, woken, moved].map((one) => one.tags.tagAgent.mock.calls.length + one.wakes.wake.mock.calls.length)).toEqual([0, 0, 0])
    })

    it("runs any other task as the internal wake its timer writes, under the person who pressed", async () => {
        const { service, tasks, wakes } = await build([])
        tasks.byId.mockResolvedValue(careTask({ dedupeKey: "follow-up:o7", title: "Ask the customer again" }))

        await expect(service.runTaskNow(item, PRESS)).resolves.toBe("woken")

        expect(wakes.wake).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "internal",
            eventKey: `task:task-7:${String(AT.getTime())}`,
            context: { taskId: "task-7", subjectId: "task-7" },
            actorMemberId: "member-owner",
        })
    })
})

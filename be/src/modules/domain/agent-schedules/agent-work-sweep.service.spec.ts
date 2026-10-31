import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { agentTurnQueueProviderOf } from "@tests/fixtures/builders/agent-work.builder"
import {
    AgentTasksService,
    AgentTriggersService,
    AgentTurnsService,
    AgentWakeRetentionService,
    AgentWakeService,
} from "@modules/domain/agent-work"
import type { AgentTriggerRecord, AgentWorkDue } from "@modules/domain/agent-work"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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

const build = async (items: ReadonlyArray<AgentWorkDue>, trigger: AgentTriggerRecord | null = record()) => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const turns = mock<AgentTurnsService>({ due: jest.fn().mockResolvedValue(items) })
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const tasks = mock<AgentTasksService>({ markWoken: jest.fn().mockResolvedValue(undefined) })
    const triggers = mock<AgentTriggersService>({
        byId: jest.fn().mockResolvedValue(trigger),
        recordFire: jest.fn().mockResolvedValue(undefined),
    })
    const retention = mock<AgentWakeRetentionService>({ sweep: jest.fn().mockResolvedValue(3) })
    const sync = mock<AgentTriggerSyncService>({ reconcile: jest.fn().mockResolvedValue(NEXT) })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkSweepService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            agentTurnQueueProviderOf(outbox),
            { provide: AgentTurnsService, useValue: turns },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentTasksService, useValue: tasks },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentWakeRetentionService, useValue: retention },
            { provide: AgentTriggerSyncService, useValue: sync },
        ],
    }).compile()
    return { service: container.get(AgentWorkSweepService), turns, wakes, tasks, triggers, retention, sync, outbox, logger, tx }
}

describe("AgentWorkSweepService.sweep, scopes to drain", () => {
    it("starts a drain for a due wake and for a lapsed lease, one per scope and minute", async () => {
        const { service, outbox, turns } = await build([
            due(),
            due({ kind: "lease", scopeKey: "conversation:conv-1", subjectId: "turn-1" }),
        ])

        await expect(service.sweep()).resolves.toMatchObject({ drains: 2 })

        expect(turns.due).toHaveBeenCalledWith(200)
        expect(outbox.jobs).toEqual([
            { queue: "agent_turn", payload: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "agent" } },
            {
                queue: "agent_turn",
                payload: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
            },
        ])
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
        const { service, wakes, sync } = await build([due({ kind: "trigger", subjectId: "trigger-1", at: MINUTES(10) })])
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

import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { queueSchedulesProviderOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentTriggersService, AgentWakeService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueSchedules } from "@modules/platform/queue"
import { AgentScheduleFireService } from "./agent-schedule-fire.service"
import { AgentSchedulesErrorCode } from "./errors/agent-schedules.error"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"

const SLOT = "1794283200000"
const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", triggerId: "trigger-1", slot: SLOT }
const NEXT = new Date("2026-11-10T04:06:00.000Z")

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

const build = async (trigger: AgentTriggerRecord | null = record(), workOn = true) => {
    const tx = fakeTransaction(mockEntityManager())
    const triggers = mock<AgentTriggersService>({
        byId: jest.fn().mockResolvedValue(trigger),
        recordFire: jest.fn().mockResolvedValue(undefined),
    })
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const sync = mock<AgentTriggerSyncService>({
        unschedule: jest.fn().mockResolvedValue(undefined),
        reconcile: jest.fn().mockResolvedValue(null),
        workIsOn: jest.fn().mockResolvedValue(workOn),
    })
    const schedules = mock<QueueSchedules>({ nextOf: jest.fn().mockResolvedValue(NEXT) })
    const logger = mock<Logger>()
    const container = await Test.createTestingModule({
        providers: [
            AgentScheduleFireService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            queueSchedulesProviderOf(schedules),
            { provide: LOGGER, useValue: logger },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentTriggerSyncService, useValue: sync },
        ],
    }).compile()
    return { service: container.get(AgentScheduleFireService), triggers, wakes, sync, schedules, logger, tx }
}

describe("AgentScheduleFireService.fire", () => {
    it("writes one schedule wake keyed by the trigger and the slot read from the job id, and records the fire in the same transaction", async () => {
        const { service, wakes, triggers, tx } = await build()

        await expect(service.fire(PAYLOAD)).resolves.toBe(true)

        expect(wakes.wake).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "schedule",
            eventKey: `trigger-1:${SLOT}`,
            context: { triggerId: "trigger-1", slot: SLOT, probeKey: "invoices_due" },
            actorMemberId: null,
        })
        expect(triggers.recordFire).toHaveBeenCalledWith(expect.anything(), "trigger-1", new Date(Number(SLOT)), NEXT)
        expect(tx.commits).toBe(1)
    })

    it("carries no probe key when the trigger names none", async () => {
        const { service, wakes } = await build(record({ probeKey: null }))

        await service.fire(PAYLOAD)

        expect(wakes.wake).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ context: { triggerId: "trigger-1", slot: SLOT } }),
        )
    })

    it.each([
        ["a trigger that is gone", null],
        ["a trigger that is off", record({ enabled: false })],
        ["an event trigger", record({ kind: "event", preset: null, eventName: "bank_credit_booked" })],
    ])("removes its own scheduler for %s and writes no wake", async (_name, trigger) => {
        const { service, wakes, sync, logger } = await build(trigger)

        await expect(service.fire(PAYLOAD)).resolves.toBe(false)

        expect(sync.unschedule).toHaveBeenCalledWith("trigger-1")
        expect(wakes.wake).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(AgentSchedulesLogEvent.OrphanUnscheduled, { triggerId: "trigger-1" })
    })

    it("makes the scheduler agree when the work of the agent is switched off, and writes no wake", async () => {
        const { service, wakes, sync } = await build(record(), false)

        await expect(service.fire(PAYLOAD)).resolves.toBe(false)

        expect(sync.reconcile).toHaveBeenCalledWith("ws-1", record())
        expect(wakes.wake).not.toHaveBeenCalled()
    })

    it("ends the job for a payload that holds no trigger or no slot", async () => {
        const { service, wakes } = await build()

        await expect(service.fire({ triggerId: "trigger-1" })).rejects.toMatchObject({
            code: AgentSchedulesErrorCode.FirePayloadInvalid,
            params: { unrecoverable: 1 },
        })

        expect(wakes.wake).not.toHaveBeenCalled()
    })
})

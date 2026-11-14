import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_SCHEDULES } from "@modules/platform/queue"
import { AgentTriggersService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueSchedules } from "@modules/platform/queue"
import { AgentScheduleFireService } from "./agent-schedule-fire.service"
import { AgentSchedulesErrorCode } from "./errors/agent-schedules.error"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { ClockTickDeliveryService } from "./clock-tick-delivery.service"

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
    const wakes = mock<ClockTickDeliveryService>({ deliverSlot: jest.fn().mockResolvedValue("woken") })
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
            { provide: QUEUE_SCHEDULES, useValue: schedules },
            { provide: LOGGER, useValue: logger },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: ClockTickDeliveryService, useValue: wakes },
            { provide: AgentTriggerSyncService, useValue: sync },
        ],
    }).compile()
    return { service: container.get(AgentScheduleFireService), triggers, wakes, sync, schedules, logger, tx }
}

describe("AgentScheduleFireService.fire", () => {
    it("delivers the slot of the row through the clock's entry for the row's agent and records the fire in the same transaction", async () => {
        const { service, wakes, triggers, tx } = await build()

        await expect(service.fire(PAYLOAD)).resolves.toBe(true)

        expect(wakes.deliverSlot).toHaveBeenCalledWith(expect.anything(), "ws-1", record(), SLOT, null)
        expect(wakes.deliverSlot.mock.calls[0]?.[0]).toBe(triggers.recordFire.mock.calls[0]?.[0])
        expect(triggers.recordFire).toHaveBeenCalledWith(expect.anything(), "trigger-1", new Date(Number(SLOT)), NEXT)
        expect(tx.commits).toBe(1)
    })

    it.each([
        ["a trigger that is gone", null],
        ["a trigger that is off", record({ enabled: false })],
        ["an event trigger", record({ kind: "event", preset: null, eventName: "bank_credit_booked" })],
    ])("removes its own scheduler for %s and writes no wake", async (_name, trigger) => {
        const { service, wakes, sync, logger } = await build(trigger)

        await expect(service.fire(PAYLOAD)).resolves.toBe(false)

        expect(sync.unschedule).toHaveBeenCalledWith("trigger-1")
        expect(wakes.deliverSlot).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(AgentSchedulesLogEvent.OrphanUnscheduled, { triggerId: "trigger-1" })
    })

    it("makes the scheduler agree when the work of the agent is switched off, and writes no wake", async () => {
        const { service, wakes, sync } = await build(record(), false)

        await expect(service.fire(PAYLOAD)).resolves.toBe(false)

        expect(sync.reconcile).toHaveBeenCalledWith("ws-1", record())
        expect(wakes.deliverSlot).not.toHaveBeenCalled()
    })

    it("ends the job for a payload that holds no trigger or no slot", async () => {
        const { service, wakes } = await build()

        await expect(service.fire({ triggerId: "trigger-1" })).rejects.toMatchObject({
            code: AgentSchedulesErrorCode.FirePayloadInvalid,
            params: { unrecoverable: 1 },
        })

        expect(wakes.deliverSlot).not.toHaveBeenCalled()
    })
})

describe("AgentScheduleFireService.fireNow (the schedule list's \"run now\")", () => {
    const SLOT_AT = new Date(Number(SLOT))

    it("writes the wake of the next slot now, under its own key and the person who pressed; the scheduler and the row are untouched", async () => {
        const { service, wakes, triggers, sync } = await build(record({ nextRunAt: SLOT_AT }))

        await expect(service.fireNow("ws-1", "trigger-1", SLOT_AT, "member-owner")).resolves.toBe("woken")

        expect(wakes.deliverSlot).toHaveBeenCalledWith(expect.anything(), "ws-1", record({ nextRunAt: SLOT_AT }), SLOT, "member-owner")
        expect(triggers.recordFire).not.toHaveBeenCalled()
        expect(sync.unschedule).not.toHaveBeenCalled()
    })

    it("answers already_ran when that slot's wake exists (the slot came or someone pressed first): the cron's fire adds nothing either", async () => {
        const { service, wakes } = await build(record({ nextRunAt: SLOT_AT }))
        wakes.deliverSlot.mockResolvedValue("already_ran")

        await expect(service.fireNow("ws-1", "trigger-1", SLOT_AT, "member-owner")).resolves.toBe("already_ran")
    })

    it("answers not_scheduled when no registered graph of the agent takes the slot", async () => {
        const { service, wakes } = await build(record({ nextRunAt: SLOT_AT }))
        wakes.deliverSlot.mockResolvedValue("untaken")

        await expect(service.fireNow("ws-1", "trigger-1", SLOT_AT, "member-owner")).resolves.toBe("not_scheduled")
    })

    it("runs nothing for a trigger gone, off, not a clock, whose next slot moved, or whose work is switched off", async () => {
        const worlds = await Promise.all([
            build(null),
            build(record({ nextRunAt: SLOT_AT, enabled: false })),
            build(record({ nextRunAt: SLOT_AT, kind: "event" })),
            build(record({ nextRunAt: NEXT })),
            build(record({ nextRunAt: SLOT_AT }), false),
        ])

        const answers = await Promise.all(worlds.map((world) => world.service.fireNow("ws-1", "trigger-1", SLOT_AT, "m")))

        expect(answers).toEqual(["not_scheduled", "not_scheduled", "not_scheduled", "not_scheduled", "not_scheduled"])
        expect(worlds.map((world) => world.wakes.deliverSlot.mock.calls.length)).toEqual([0, 0, 0, 0, 0])
    })
})

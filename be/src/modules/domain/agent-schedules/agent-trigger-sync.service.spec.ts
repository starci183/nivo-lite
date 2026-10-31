import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { agentTriggerRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentTriggersService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { CLOCK } from "@modules/platform/clock"
import { QUEUE_SCHEDULES } from "@modules/platform/queue"
import type { QueueSchedules } from "@modules/platform/queue"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"

const NOW = "2026-11-10T03:00:00.000Z"
const NEXT = new Date("2026-11-10T04:06:00.000Z")

const record = (over: Partial<AgentTriggerRecord> = {}): AgentTriggerRecord => ({
    id: "trigger-1",
    agentId: "agent-9",
    kind: "schedule",
    preset: "hourly",
    atTime: null,
    timeZone: "Asia/Ho_Chi_Minh",
    eventName: null,
    probeKey: null,
    enabled: true,
    seedKey: null,
    nextRunAt: null,
    lastFiredAt: null,
    ...over,
})

interface Options {
    readonly workspaceOn?: boolean
    readonly agentOn?: boolean
}

const build = async ({ workspaceOn = true, agentOn = true }: Options = {}) => {
    const schedules = mock<QueueSchedules>({
        schedule: jest.fn().mockResolvedValue(NEXT),
        unschedule: jest.fn().mockResolvedValue(undefined),
    })
    const triggers = mock<AgentTriggersService>({
        recordReconciled: jest.fn().mockResolvedValue(undefined),
        seed: jest.fn().mockResolvedValue(agentTriggerRowOf()),
    })
    const settings = mock<AgentWorkSettingsService>({
        settingsOf: jest.fn().mockResolvedValue({ workEnabled: workspaceOn }),
        stateOf: jest.fn().mockResolvedValue({ workEnabled: agentOn }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentTriggerSyncService,
            { provide: QUEUE_SCHEDULES, useValue: schedules },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentWorkSettingsService, useValue: settings },
        ],
    }).compile()
    return { service: container.get(AgentTriggerSyncService), schedules, triggers, settings }
}

describe("AgentTriggerSyncService.reconcile", () => {
    it("makes a keyed scheduler on the agent's spread minute, and records the next slot it holds", async () => {
        const { service, schedules, triggers } = await build()

        await expect(service.reconcile("ws-1", record())).resolves.toEqual(NEXT)

        expect(schedules.schedule).toHaveBeenCalledWith(
            "agent_schedule_fire",
            "agent-trigger:trigger-1",
            { pattern: "6 * * * *", tz: "Asia/Ho_Chi_Minh" },
            "agent-schedule.fire",
            { workspaceId: "ws-1", agentId: "agent-9", triggerId: "trigger-1" },
        )
        expect(triggers.recordReconciled).toHaveBeenCalledWith("trigger-1", new Date(NOW), NEXT)
    })

    it.each([
        ["a trigger that is off", record({ enabled: false }), {}],
        ["an event trigger", record({ kind: "event", preset: null, eventName: "bank_credit_booked" }), {}],
        ["an agent whose work is switched off", record(), { agentOn: false }],
        ["a workspace whose work is switched off", record(), { workspaceOn: false }],
    ])("keeps no scheduler for %s", async (_name, trigger, options) => {
        const { service, schedules, triggers } = await build(options)

        await expect(service.reconcile("ws-1", trigger)).resolves.toBeNull()

        expect(schedules.unschedule).toHaveBeenCalledWith("agent_schedule_fire", "agent-trigger:trigger-1")
        expect(schedules.schedule).not.toHaveBeenCalled()
        expect(triggers.recordReconciled).toHaveBeenCalledWith("trigger-1", new Date(NOW), null)
    })
})

describe("AgentTriggerSyncService.unschedule and workIsOn", () => {
    it("removes the scheduler of the trigger", async () => {
        const { service, schedules } = await build()

        await service.unschedule("trigger-2")

        expect(schedules.unschedule).toHaveBeenCalledWith("agent_schedule_fire", "agent-trigger:trigger-2")
    })

    it("is on only while the workspace and the agent are both on", async () => {
        await expect((await build()).service.workIsOn("ws-1", "agent-1")).resolves.toBe(true)
        await expect((await build({ agentOn: false })).service.workIsOn("ws-1", "agent-1")).resolves.toBe(false)
        await expect((await build({ workspaceOn: false })).service.workIsOn("ws-1", "agent-1")).resolves.toBe(false)
    })
})

describe("AgentTriggerSyncService.seed", () => {
    it("seeds one row per key and leaves the schedulers to the minute sweep", async () => {
        const { service, triggers, schedules } = await build()

        await service.seed("ws-1", "agent-1", [
            { key: "morning", preset: "daily_at", atTime: "08:00", probeKey: "invoices_due" },
            { key: "pulse", preset: "hourly" },
        ])

        expect(triggers.seed).toHaveBeenNthCalledWith(
            1,
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                triggerId: null,
                kind: "schedule",
                preset: "daily_at",
                atTime: "08:00",
                timeZone: null,
                eventName: null,
                probeKey: "invoices_due",
                enabled: true,
            },
            "morning",
        )
        expect(triggers.seed).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ preset: "hourly", atTime: null, probeKey: null }),
            "pulse",
        )
        expect(schedules.schedule).not.toHaveBeenCalled()
    })

    it("asks the same row for the same key when the module is installed again", async () => {
        const { service, triggers } = await build()
        const seeds = [{ key: "morning", preset: "hourly" as const }]

        await service.seed("ws-1", "agent-1", seeds)
        await service.seed("ws-1", "agent-1", seeds)

        expect(triggers.seed.mock.calls.map(([, key]) => key)).toEqual(["morning", "morning"])
    })
})

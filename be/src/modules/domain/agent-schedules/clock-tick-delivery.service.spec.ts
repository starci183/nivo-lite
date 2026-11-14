import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import { ClockTickDeliveryService } from "./clock-tick-delivery.service"
import { CLOCK_TICK_TRIGGER } from "./engine-time.triggers"

const SLOT = "1794283200000"

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

const delivered = (woken: number, repeats = 0): DeliverResult => ({
    status: "delivered",
    events: 1,
    dropped: 0,
    woken: Array.from({ length: woken }, () => ({
        agentId: "agent-1",
        workflowId: "wf-1",
        eventId: `trigger-1:${SLOT}`,
        wakeId: "wake-1",
    })),
    repeats,
    untaken: woken + repeats === 0 ? 1 : 0,
    held: 0,
})

const build = async () => {
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(delivered(1))
    const moduleRef = await Test.createTestingModule({
        providers: [ClockTickDeliveryService, { provide: ProviderTriggersService, useValue: triggers }],
    }).compile()
    return { clock: moduleRef.get(ClockTickDeliveryService), triggers, tx: mockEntityManager() }
}

describe("ClockTickDeliveryService", () => {
    it("hands ONE event per slot to the delivery: the clock's declaration, the row's own agent, the slot's old once-key, no account", async () => {
        const { clock, triggers, tx } = await build()

        await expect(clock.deliverSlot(tx, "ws-1", record(), SLOT, null)).resolves.toBe("woken")

        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                declaration: CLOCK_TICK_TRIGGER,
                connectionId: null,
                agentId: "agent-1",
                events: [
                    {
                        event: {
                            id: `trigger-1:${SLOT}`,
                            data: { triggerId: "trigger-1", slotMs: Number(SLOT) },
                        },
                        actorMemberId: null,
                        occurredAt: new Date(Number(SLOT)).toISOString(),
                    },
                ],
            },
            tx,
        )
    })

    it("names the person who pressed run now, and the same event id for the same slot (the job, the sweep and a press are one)", async () => {
        const { clock, triggers, tx } = await build()

        await clock.deliverSlot(tx, "ws-1", record(), SLOT, "member-1")
        await clock.deliverSlot(tx, "ws-1", record(), SLOT, null)

        expect(
            triggers.deliver.mock.calls.map((call) => [call[0].events[0]?.event.id, call[0].events[0]?.actorMemberId]),
        ).toEqual([
            [`trigger-1:${SLOT}`, "member-1"],
            [`trigger-1:${SLOT}`, null],
        ])
        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.event.data).toEqual({
            triggerId: "trigger-1",
            slotMs: Number(SLOT),
        })
    })

    it("answers already_ran for a slot delivered before and untaken when no registered graph took it", async () => {
        const { clock, triggers, tx } = await build()
        triggers.deliver.mockResolvedValueOnce(delivered(0, 1)).mockResolvedValueOnce(delivered(0))

        await expect(clock.deliverSlot(tx, "ws-1", record(), SLOT, null)).resolves.toBe("already_ran")
        await expect(clock.deliverSlot(tx, "ws-1", record(), SLOT, null)).resolves.toBe("untaken")
    })
})

import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import {
    agentTriggerRowOf,
    agentTriggerWriteOf,
    disabledTriggerRowOf,
    eventTriggerRowOf,
    seededTriggerRowOf,
} from "@tests/fixtures/builders/agent-work.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTriggerEntity } from "./persistence/entities"

const NOW = new Date("2026-11-10T03:00:00.000Z")

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn().mockResolvedValue("seat-1"),
        agent: jest.fn().mockResolvedValue(undefined),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentTriggersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentWorkAccessService, useValue: access },
        ],
    }).compile()
    return { service: container.get(AgentTriggersService), em, access }
}

describe("AgentTriggersService reads", () => {
    it("lists the triggers of an agent, with the time of day cut to the minute", async () => {
        const { service, em } = await build(mockEntityManager({ find: [AgentTriggerEntity, [agentTriggerRowOf()]] }))

        await expect(service.ofAgent("agent-1")).resolves.toEqual([
            expect.objectContaining({ id: "trigger-1", atTime: "08:30", preset: "daily_at" }),
        ])
        expect(em.find).toHaveBeenCalledWith(AgentTriggerEntity, {
            where: { agentId: "agent-1" },
            order: { createdAt: "ASC" },
            take: 8,
        })
    })

    it("finds the enabled event triggers that name an event, within a bound", async () => {
        const row = eventTriggerRowOf()
        const { service, em } = await build(mockEntityManager({ find: [AgentTriggerEntity, [row]] }))

        await expect(service.enabledForEvent("bank_credit_booked", 25)).resolves.toHaveLength(1)
        expect(em.find).toHaveBeenCalledWith(AgentTriggerEntity, {
            where: { kind: "event", eventName: "bank_credit_booked", enabled: true },
            order: { createdAt: "ASC" },
            take: 25,
        })
    })

    it("reads one trigger by id, or null", async () => {
        const known = await build(mockEntityManager({ findOne: [AgentTriggerEntity, agentTriggerRowOf()] }))
        const unknown = await build(mockEntityManager({ findOne: [AgentTriggerEntity, null] }))

        await expect(known.service.byId("trigger-1")).resolves.toMatchObject({ id: "trigger-1" })
        await expect(unknown.service.byId("trigger-9")).resolves.toBeNull()
    })
})

describe("AgentTriggersService.save", () => {
    it("creates a trigger for an owner or manager under the agent's cap", async () => {
        const { service, em, access } = await build(
            mockEntityManager({
                count: [AgentTriggerEntity, 7],
                save: [AgentTriggerEntity, agentTriggerRowOf()],
            }),
        )

        await expect(service.save("user-1", agentTriggerWriteOf())).resolves.toMatchObject({ id: "trigger-1" })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(access.agent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(em.save).toHaveBeenCalledWith(AgentTriggerEntity, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            kind: "schedule",
            preset: "daily_at",
            atTime: "08:30",
            timeZone: "Asia/Ho_Chi_Minh",
            eventName: null,
            probeKey: "invoices_due",
            enabled: true,
            seedKey: null,
        })
    })

    it("lets a module seed a trigger with no member behind it", async () => {
        const { service, access } = await build(
            mockEntityManager({
                count: [AgentTriggerEntity, 0],
                save: [AgentTriggerEntity, agentTriggerRowOf()],
            }),
        )

        await service.save(null, agentTriggerWriteOf())

        expect(access.manager).not.toHaveBeenCalled()
        expect(access.agent).toHaveBeenCalled()
    })

    it("refuses a ninth trigger", async () => {
        const { service, em } = await build(mockEntityManager({ count: [AgentTriggerEntity, 8] }))

        await expect(service.save("user-1", agentTriggerWriteOf())).rejects.toMatchObject({
            code: AgentWorkErrorCode.TooManyTriggers,
            params: { max: 8 },
        })
        expect(em.save).not.toHaveBeenCalled()
    })

    it("refuses a trigger that does not say when it fires, before reading anything", async () => {
        const { service, em } = await build()

        await expect(service.save("user-1", agentTriggerWriteOf({ preset: null }))).rejects.toMatchObject({
            code: AgentWorkErrorCode.TriggerShapeInvalid,
        })
        expect(em.count).not.toHaveBeenCalled()
    })
})

describe("AgentTriggersService.seed", () => {
    it("writes the trigger under its key the first time, as the system, within the cap", async () => {
        const { service, em, access } = await build(
            mockEntityManager({
                findOne: [AgentTriggerEntity, null],
                count: [AgentTriggerEntity, 2],
                save: [AgentTriggerEntity, seededTriggerRowOf()],
            }),
        )

        await expect(service.seed(agentTriggerWriteOf(), "morning")).resolves.toMatchObject({ seedKey: "morning" })

        expect(access.manager).not.toHaveBeenCalled()
        expect(em.findOne).toHaveBeenCalledWith(AgentTriggerEntity, { where: { agentId: "agent-1", seedKey: "morning" } })
        expect(em.save).toHaveBeenCalledWith(AgentTriggerEntity, expect.objectContaining({ seedKey: "morning" }))
    })

    it("finds the row a key already wrote and writes no second one", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentTriggerEntity, seededTriggerRowOf()] }),
        )

        await expect(service.seed(agentTriggerWriteOf(), "morning")).resolves.toMatchObject({
            id: "trigger-1",
            seedKey: "morning",
        })

        expect(em.save).not.toHaveBeenCalled()
    })

    it("refuses a seed past the cap of eight", async () => {
        const { service } = await build(
            mockEntityManager({ findOne: [AgentTriggerEntity, null], count: [AgentTriggerEntity, 8] }),
        )

        await expect(service.seed(agentTriggerWriteOf(), "morning")).rejects.toMatchObject({
            code: AgentWorkErrorCode.TooManyTriggers,
        })
    })
})

describe("AgentTriggersService.save, changing a trigger", () => {
    it("changes a trigger of the agent, marks it unreconciled and answers it as it is now", async () => {
        const { service, em } = await build(
            mockEntityManager({
                update: [AgentTriggerEntity, { affected: 1 }],
                findOne: [AgentTriggerEntity, disabledTriggerRowOf()],
            }),
        )

        await expect(
            service.save("user-1", agentTriggerWriteOf({ triggerId: "trigger-1", enabled: false })),
        ).resolves.toMatchObject({
            enabled: false,
        })

        expect(em.update).toHaveBeenCalledWith(
            AgentTriggerEntity,
            { id: "trigger-1", agentId: "agent-1", workspaceId: "ws-1" },
            expect.objectContaining({ enabled: false, reconciledAt: null }),
        )
        expect(em.count).not.toHaveBeenCalled()
    })

    it("refuses to change a trigger that is not the agent's", async () => {
        const { service } = await build(mockEntityManager({ update: [AgentTriggerEntity, { affected: 0 }] }))

        await expect(service.save("user-1", agentTriggerWriteOf({ triggerId: "trigger-9" }))).rejects.toMatchObject({
            code: AgentWorkErrorCode.TriggerNotFound,
        })
    })

    it("refuses a trigger that vanished between the change and the read", async () => {
        const { service } = await build(
            mockEntityManager({
                update: [AgentTriggerEntity, { affected: 1 }],
                findOne: [AgentTriggerEntity, null],
            }),
        )

        await expect(service.save("user-1", agentTriggerWriteOf({ triggerId: "trigger-1" }))).rejects.toMatchObject({
            code: AgentWorkErrorCode.TriggerNotFound,
        })
    })

    it("refuses staff before anything else", async () => {
        const { service, access } = await build()
        access.manager.mockRejectedValueOnce(new Error("staff"))

        await expect(service.save("user-3", agentTriggerWriteOf())).rejects.toThrow("staff")
        expect(access.agent).not.toHaveBeenCalled()
    })
})

describe("AgentTriggersService.remove", () => {
    it("removes a trigger of the agent for an owner or manager", async () => {
        const { service, em, access } = await build(
            mockEntityManager({ delete: [AgentTriggerEntity, { affected: 1 }] }),
        )

        await service.remove("user-1", "ws-1", "agent-1", "trigger-1")

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.delete).toHaveBeenCalledWith(AgentTriggerEntity, {
            id: "trigger-1",
            agentId: "agent-1",
            workspaceId: "ws-1",
        })
    })

    it("refuses a trigger that is not the agent's", async () => {
        const { service } = await build(mockEntityManager({ delete: [AgentTriggerEntity, { affected: 0 }] }))

        await expect(service.remove("user-1", "ws-1", "agent-1", "trigger-9")).rejects.toMatchObject({
            code: AgentWorkErrorCode.TriggerNotFound,
        })
    })
})

describe("AgentTriggersService records", () => {
    it("records a fire in the caller's transaction", async () => {
        const { service } = await build()
        const tx = mockEntityManager({ update: [AgentTriggerEntity, { affected: 1 }] })

        await service.recordFire(tx, "trigger-1", NOW, new Date("2026-11-10T04:00:00.000Z"))

        expect(tx.update).toHaveBeenCalledWith(
            AgentTriggerEntity,
            { id: "trigger-1" },
            { lastFiredAt: NOW, nextRunAt: new Date("2026-11-10T04:00:00.000Z") },
        )
    })

    it("records that the scheduler agrees with the row", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentTriggerEntity, { affected: 1 }] }))

        await service.recordReconciled("trigger-1", NOW, null)

        expect(em.update).toHaveBeenCalledWith(
            AgentTriggerEntity,
            { id: "trigger-1" },
            { reconciledAt: NOW, nextRunAt: null },
        )
    })
})

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ProviderTriggerDeadEventEntity, ProviderTriggerSwitchEntity } from "./persistence/entities"
import { ProviderTriggerStoreService } from "./provider-trigger-store.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ProviderTriggerStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ProviderTriggerStoreService)
}

describe("ProviderTriggerStoreService", () => {
    it("finds the switch of one trigger on one account on the caller's manager; none is off", async () => {
        const held = Object.assign(new ProviderTriggerSwitchEntity(), { id: "switch-1", enabled: true })
        const em = mockEntityManager({ findOne: [ProviderTriggerSwitchEntity, held] })
        const store = await build(mockEntityManager())

        await expect(store.find(em, "conn-1", "transaction.received")).resolves.toBe(held)
        expect(em.findOne).toHaveBeenCalledWith(ProviderTriggerSwitchEntity, {
            where: { connectionId: "conn-1", triggerName: "transaction.received" },
        })
    })

    it("reads the decider the owner bound on one account trigger, on the caller's manager; none bound or never touched is null", async () => {
        const bound = Object.assign(new ProviderTriggerSwitchEntity(), { id: "switch-1", deciderAgentId: "agent-2" })
        const em = mockEntityManager({ findOne: [ProviderTriggerSwitchEntity, bound] })
        const store = await build(mockEntityManager({ findOne: [ProviderTriggerSwitchEntity, null] }))

        await expect(store.boundDeciderOf("conn-1", "transaction.received", em)).resolves.toBe("agent-2")
        expect(em.findOne).toHaveBeenCalledWith(ProviderTriggerSwitchEntity, {
            select: { id: true, deciderAgentId: true },
            where: { connectionId: "conn-1", triggerName: "transaction.received" },
        })
        await expect(store.boundDeciderOf("conn-1", "transaction.received")).resolves.toBeNull()
    })

    it("lists the switches of one account of the workspace, bounded", async () => {
        const em = mockEntityManager({ find: [ProviderTriggerSwitchEntity, []] })

        await (await build(em)).listOf("ws-1", "conn-1")

        expect(em.find).toHaveBeenCalledWith(ProviderTriggerSwitchEntity, {
            where: { workspaceId: "ws-1", connectionId: "conn-1" },
            order: { triggerName: "ASC" },
            take: 50,
        })
    })

    it("writes a change as one row per account and trigger, keeping what the change leaves out", async () => {
        const em = mockEntityManager({ upsert: [ProviderTriggerSwitchEntity, { identifiers: [], generatedMaps: [], raw: [] }] })

        await (await build(em)).change("ws-1", "conn-1", "transaction.received", { deciderAgentId: "agent-1" })

        expect(em.upsert).toHaveBeenCalledWith(
            ProviderTriggerSwitchEntity,
            { workspaceId: "ws-1", connectionId: "conn-1", triggerName: "transaction.received", deciderAgentId: "agent-1" },
            ["connectionId", "triggerName"],
        )
    })

    it("records when a trigger fired and how many events, on the caller's manager", async () => {
        const em = mockEntityManager({
            update: [ProviderTriggerSwitchEntity, { affected: 1 }],
            increment: [ProviderTriggerSwitchEntity, { affected: 1 }],
        })
        const at = new Date("2026-11-12T04:00:00Z")

        await (await build(mockEntityManager())).markFired(em, "switch-1", at, 3)

        expect(em.update).toHaveBeenCalledWith(ProviderTriggerSwitchEntity, { id: "switch-1" }, { lastFiredAt: at })
        expect(em.increment).toHaveBeenCalledWith(ProviderTriggerSwitchEntity, { id: "switch-1" }, "firedCount", 3)
    })

    it("keeps a dead event once per wake key", async () => {
        const em = mockEntityManager({ upsert: [ProviderTriggerDeadEventEntity, { identifiers: [], generatedMaps: [], raw: [] }] })
        const dead = {
            workspaceId: "ws-1",
            connectionId: "conn-1",
            triggerName: "transaction.received",
            agentId: "agent-1",
            role: "notice" as const,
            eventKey: "provider:conn-1:sepay:transaction.received:sepay:1:agent-1",
            reason: "failed",
            params: { transactionId: "tx-1", direction: "in" },
        }

        await (await build(mockEntityManager())).keepDead(em, dead)

        expect(em.upsert).toHaveBeenCalledWith(ProviderTriggerDeadEventEntity, dead, ["eventKey"])
    })
})

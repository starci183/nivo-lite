import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, LessThan, Like } from "typeorm"
import { heldCustomerWakeRowOf, idleLeaseRowsOf } from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentWakeRetentionService } from "./agent-wake-retention.service"
import { AgentWakeEntity, AgentWorkLeaseEntity } from "./persistence/entities"

const NOW = "2026-11-10T03:00:00.000Z"
const DAY_MS = 24 * 60 * 60_000

const build = async (em: MockEntityManager) => {
    const container = await Test.createTestingModule({
        providers: [
            AgentWakeRetentionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: container.get(AgentWakeRetentionService), em }
}

describe("AgentWakeRetentionService.sweep", () => {
    it("removes skipped wakes older than two days and every other ended wake older than thirty, a bounded batch of each", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [
                    [AgentWakeEntity, [heldCustomerWakeRowOf("wake-1"), heldCustomerWakeRowOf("wake-2")]],
                    [AgentWorkLeaseEntity, []],
                ],
                delete: [AgentWakeEntity, { affected: 2 }],
            }),
        )

        await expect(service.sweep(500)).resolves.toBe(4)

        const now = new Date(NOW).getTime()
        expect(em.find).toHaveBeenNthCalledWith(1, AgentWakeEntity, {
            select: { id: true },
            where: { status: In(["skipped"]), createdAt: LessThan(new Date(now - 2 * DAY_MS)) },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(em.find).toHaveBeenNthCalledWith(2, AgentWakeEntity, {
            select: { id: true },
            where: { status: In(["done", "held", "failed", "dead"]), createdAt: LessThan(new Date(now - 30 * DAY_MS)) },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(em.delete).toHaveBeenCalledWith(AgentWakeEntity, { id: In(["wake-1", "wake-2"]) })
    })
})

describe("AgentWakeRetentionService.sweep, idle conversation leases", () => {
    it("removes the lease row of a conversation idle for two days, one by its key, and keeps a running or the agent's own", async () => {
        const idle = idleLeaseRowsOf()
        const { service, em } = await build(
            mockEntityManager({
                find: [
                    [AgentWakeEntity, []],
                    [AgentWorkLeaseEntity, idle],
                ],
                delete: [AgentWorkLeaseEntity, { affected: 1 }],
            }),
        )

        await expect(service.sweep(50)).resolves.toBe(2)

        expect(em.find).toHaveBeenCalledWith(AgentWorkLeaseEntity, {
            select: { agentId: true, scopeKey: true },
            where: {
                scopeKey: Like("conversation:%"),
                runningTurnId: IsNull(),
                updatedAt: LessThan(new Date(new Date(NOW).getTime() - 2 * DAY_MS)),
            },
            order: { updatedAt: "ASC" },
            take: 50,
        })
        expect(em.delete).toHaveBeenCalledWith(AgentWorkLeaseEntity, {
            agentId: "agent-1",
            scopeKey: "conversation:conv-1",
        })
        expect(em.delete).toHaveBeenCalledWith(AgentWorkLeaseEntity, {
            agentId: "agent-1",
            scopeKey: "conversation:conv-2",
        })
    })

    it("counts nothing for a lease delete that reports no rows", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [
                    [AgentWakeEntity, []],
                    [AgentWorkLeaseEntity, idleLeaseRowsOf().slice(0, 1)],
                ],
                delete: [AgentWorkLeaseEntity, {}],
            }),
        )

        await expect(service.sweep(50)).resolves.toBe(0)
    })

    it("deletes nothing when no wake is past retention", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [
                    [AgentWakeEntity, []],
                    [AgentWorkLeaseEntity, []],
                ],
            }),
        )

        await expect(service.sweep(500)).resolves.toBe(0)

        expect(em.delete).not.toHaveBeenCalled()
    })

    it("counts nothing for a delete that reports no rows", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [
                    [AgentWakeEntity, [heldCustomerWakeRowOf("wake-1")]],
                    [AgentWorkLeaseEntity, []],
                ],
                delete: [AgentWakeEntity, {}],
            }),
        )

        await expect(service.sweep(10)).resolves.toBe(0)
    })
})

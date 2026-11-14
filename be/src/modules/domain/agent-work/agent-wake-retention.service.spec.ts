import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, LessThan } from "typeorm"
import { heldCustomerWakeRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentWakeRetentionService } from "./agent-wake-retention.service"
import { AgentWakeEntity, AgentWorkLeaseEntity } from "./persistence/entities"

const NOW = "2026-11-10T03:00:00.000Z"
const DAY_MS = 24 * 60 * 60_000

/** The one statement the back end may send for the lease rows: the definer function, never a DELETE on the table (app_be holds SELECT). */
const EXPIRE_LEASES = `SELECT * FROM "public"."agent_work_leases_expire"($1, $2)`

const expired = (removed: unknown): [string, Array<Record<string, unknown>>] => [
    EXPIRE_LEASES,
    [{ agent_work_leases_expire: removed }],
]

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
                find: [AgentWakeEntity, [heldCustomerWakeRowOf("wake-1"), heldCustomerWakeRowOf("wake-2")]],
                delete: [AgentWakeEntity, { affected: 2 }],
                query: expired(0),
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

    it("deletes nothing when no wake is past retention", async () => {
        const { service, em } = await build(mockEntityManager({ find: [AgentWakeEntity, []], query: expired(0) }))

        await expect(service.sweep(500)).resolves.toBe(0)

        expect(em.delete).not.toHaveBeenCalled()
    })

    it("counts nothing for a delete that reports no rows", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [AgentWakeEntity, [heldCustomerWakeRowOf("wake-1")]],
                delete: [AgentWakeEntity, {}],
                query: expired(0),
            }),
        )

        await expect(service.sweep(10)).resolves.toBe(0)
    })
})

describe("AgentWakeRetentionService.sweep, idle conversation leases", () => {
    it("removes the idle conversation lease rows through agent_work_leases_expire, with the two-day line and the batch", async () => {
        const { service, em } = await build(mockEntityManager({ find: [AgentWakeEntity, []], query: expired(2) }))

        await expect(service.sweep(50)).resolves.toBe(2)

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(EXPIRE_LEASES, [new Date(new Date(NOW).getTime() - 2 * DAY_MS), 50])
    })

    it("never reads or writes the lease table itself: app_be may only select it, so a DELETE there is refused by the database", async () => {
        const { service, em } = await build(mockEntityManager({ find: [AgentWakeEntity, []], query: expired(1) }))

        await service.sweep(50)

        expect(em.find).not.toHaveBeenCalledWith(AgentWorkLeaseEntity, expect.anything())
        expect(em.delete).not.toHaveBeenCalled()
    })

    it.each([[null], [undefined], ["3"], [-1], [1.5]])("counts nothing for an answer that is not a count (%p)", async (answer) => {
        const { service } = await build(mockEntityManager({ find: [AgentWakeEntity, []], query: expired(answer) }))

        await expect(service.sweep(50)).resolves.toBe(0)
    })

    it("counts nothing when the function answers no row", async () => {
        const { service } = await build(mockEntityManager({ find: [AgentWakeEntity, []], query: [EXPIRE_LEASES, []] }))

        await expect(service.sweep(50)).resolves.toBe(0)
    })
})

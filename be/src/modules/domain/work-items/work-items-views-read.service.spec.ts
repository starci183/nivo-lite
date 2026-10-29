import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { entityOf, rowOf } from "@tests/fixtures/builders/work-items.builder"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsViewsReadService } from "./work-items-views-read.service"

const build = async (answers: ReadonlyArray<QueryBuilderAnswers>, em: MockEntityManager = mockEntityManager()) => {
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsViewsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(WorkItemsViewsReadService), fakes, em }
}

describe("WorkItemsViewsReadService", () => {
    it("finds one item with its cursor at full precision, null when there is none", async () => {
        const stamp = { id: "w-1", cursor_at: "2026-10-12T10:00:00.123456+00:00" }
        const { service } = await build([
            { getMany: [entityOf(rowOf({ id: "w-1" }))] },
            { getRawMany: [stamp] },
            { getMany: [] },
        ])

        await expect(service.find("ws-1", "w-1")).resolves.toMatchObject({
            item: { id: "w-1" },
            cursorAt: stamp.cursor_at,
        })
        await expect(service.find("ws-1", "w-2")).resolves.toBeNull()
    })

    it("falls back to the item's own instant when the stamp read misses a row", async () => {
        const { service } = await build([{ getMany: [entityOf(rowOf({ id: "w-1" }))] }, { getRawMany: [] }])

        await expect(service.find("ws-1", "w-1")).resolves.toMatchObject({ cursorAt: "2026-10-12T09:00:00.000Z" })
    })

    it("lists a page newest first and narrows by status, keyset and action", async () => {
        const { service, fakes } = await build([
            { getMany: [entityOf(rowOf({ id: "w-1" }))] },
            { getRawMany: [{ id: "w-1", cursor_at: "t" }] },
            { getMany: [] },
        ])
        const after = { createdAt: "2026-10-12T10:00:00.000000+00:00", id: "w-9" }

        await expect(
            service.listPage("ws-1", { statuses: ["done"], after, action: "send_quote", limit: 3 }),
        ).resolves.toHaveLength(1)
        await expect(service.listPage("ws-1", { statuses: [], after: null, action: null, limit: 3 })).resolves.toEqual(
            [],
        )
        expect(fakes[0]?.callsOf("andWhere").map(([sql]) => sql)).toEqual([
            "w.status IN (:...statuses)",
            "(w.createdAt, w.id) < (CAST(:afterCreatedAt AS timestamptz), CAST(:afterId AS uuid))",
            "w.action = :action",
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[3]])
    })

    it("lists the accounting work waiting for a decision, oldest first", async () => {
        const em = mockEntityManager({ find: [WorkItemEntity, [entityOf(rowOf({ id: "w-1" }))]] })
        const { service } = await build([], em)

        await expect(service.waitingAccounting("ws-1", 5)).resolves.toMatchObject([{ id: "w-1" }])
        expect(em.find).toHaveBeenCalledWith(
            WorkItemEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", department: "accounting", status: "waiting_decision" },
                take: 5,
            }),
        )
    })
})

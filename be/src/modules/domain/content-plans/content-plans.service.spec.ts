import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ContentAiStoreService } from "@modules/domain/content-items"
import type { ContentGeneratedPlan } from "@modules/domain/content-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentPlansErrorCode } from "./errors/content-plans.error"
import { ContentPlansService } from "./content-plans.service"
import { INSERT_CONTENT_PLAN, LOCK_CONTENT_PLAN } from "./persistence/content-plans.sql"

const PLAN: ContentGeneratedPlan = {
    month: "2026-10",
    actor: "An",
    items: [
        {
            title: "Hours",
            brief: "Open daily",
            pillarId: "pillar-1",
            channels: ["facebook"],
            scheduledAt: "2026-10-02T01:00:00.000Z",
            holidayKey: null,
        },
    ],
    meta: { source: "engine" },
    generationId: "gen-1",
    aiMs: 12,
}

const build = async () => {
    const entityManager = mockEntityManager({
        query: [
            [LOCK_CONTENT_PLAN, []],
            [INSERT_CONTENT_PLAN, [{ id: "plan-1" }]],
        ],
    })
    const tx = fakeTransaction(entityManager)
    const items = mock<ContentAiStoreService>()
    items.insertPlannedIdeas.mockResolvedValue(1)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentPlansService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ContentAiStoreService, useValue: items },
        ],
    }).compile()
    return { plans: moduleRef.get(ContentPlansService), tx, items }
}

describe("ContentPlansService", () => {
    it("saves the plan and its ideas in one transaction", async () => {
        const { plans, tx, items } = await build()

        await expect(plans.apply("ws-1", PLAN)).resolves.toEqual({ planId: "plan-1", ideas: 1 })
        expect(tx.commits).toBe(1)
        expect(items.insertPlannedIdeas).toHaveBeenCalledWith("ws-1", "plan-1", PLAN, expect.anything())
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_CONTENT_PLAN, [
            "ws-1",
            "2026-10-01",
            1,
            12,
            JSON.stringify({ source: "engine", generation_id: "gen-1" }),
            "An",
        ])
    })

    it("uses the caller's transaction instead of opening one", async () => {
        const { plans, tx, items } = await build()
        const handed = mockEntityManager({
            query: [
                [LOCK_CONTENT_PLAN, []],
                [INSERT_CONTENT_PLAN, [{ id: "plan-2" }]],
            ],
        })

        await expect(plans.apply("ws-1", PLAN, handed)).resolves.toEqual({ planId: "plan-2", ideas: 1 })
        expect(tx.commits).toBe(0)
        expect(items.insertPlannedIdeas).toHaveBeenCalledWith("ws-1", "plan-2", PLAN, handed)
    })

    it("refuses when the insert writes no row", async () => {
        const entityManager = mockEntityManager({
            query: [
                [LOCK_CONTENT_PLAN, []],
                [INSERT_CONTENT_PLAN, []],
            ],
        })
        const tx = fakeTransaction(entityManager)
        const items = mock<ContentAiStoreService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContentPlansService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: ContentAiStoreService, useValue: items },
            ],
        }).compile()
        const plans = moduleRef.get(ContentPlansService)

        await expect(plans.apply("ws-1", PLAN)).rejects.toMatchObject({ code: ContentPlansErrorCode.NotWritten })
        expect(tx.rollbacks).toBe(1)
        expect(items.insertPlannedIdeas).not.toHaveBeenCalled()
    })
})

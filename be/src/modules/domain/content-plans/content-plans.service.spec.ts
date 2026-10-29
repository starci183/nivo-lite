import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentGeneratedPlan } from "@modules/domain/content-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { ContentPlansErrorCode } from "./errors/content-plans.error"
import { ContentPlansService } from "./content-plans.service"
import { ContentPlanEntity } from "./persistence/entities"

/** The statement `advisoryXactLock` sends. */
const LOCK_CONTENT_PLAN = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"

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
        query: [LOCK_CONTENT_PLAN, []],
        insert: [ContentPlanEntity, { identifiers: [{ id: "plan-1" }] }],
    })
    const tx = fakeTransaction(entityManager)
    const editor = mock<ContentEditorService>()
    const items = mock<ContentAiStoreService>()
    items.insertPlannedIdeas.mockResolvedValue(1)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentPlansService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ContentAiStoreService, useValue: items },
            { provide: ContentEditorService, useValue: editor },
        ],
    }).compile()
    return { plans: moduleRef.get(ContentPlansService), tx, items, editor, entityManager }
}

describe("ContentPlansService", () => {
    it("saves the plan and its ideas in one transaction", async () => {
        const { plans, tx, items } = await build()

        await expect(plans.apply("ws-1", PLAN)).resolves.toEqual({ planId: "plan-1", ideas: 1 })
        expect(tx.commits).toBe(1)
        expect(items.insertPlannedIdeas).toHaveBeenCalledWith("ws-1", "plan-1", PLAN, expect.anything())
        expect(tx.em.insert).toHaveBeenCalledWith(ContentPlanEntity, {
            workspaceId: "ws-1",
            month: "2026-10-01",
            status: "done",
            ideaCount: 1,
            aiMs: 12,
            meta: { source: "engine", generation_id: "gen-1" },
            createdBy: "An",
        })
    })

    it("uses the caller's transaction instead of opening one", async () => {
        const { plans, tx, items } = await build()
        const handed = mockEntityManager({
            query: [LOCK_CONTENT_PLAN, []],
            insert: [ContentPlanEntity, { identifiers: [{ id: "plan-2" }] }],
        })

        await expect(plans.apply("ws-1", PLAN, handed)).resolves.toEqual({ planId: "plan-2", ideas: 1 })
        expect(tx.commits).toBe(0)
        expect(items.insertPlannedIdeas).toHaveBeenCalledWith("ws-1", "plan-2", PLAN, handed)
    })

    it("refuses when the insert writes no row", async () => {
        const entityManager = mockEntityManager({
            query: [LOCK_CONTENT_PLAN, []],
            insert: [ContentPlanEntity, { identifiers: [] }],
        })
        const tx = fakeTransaction(entityManager)
        const items = mock<ContentAiStoreService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContentPlansService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: ContentAiStoreService, useValue: items },
                { provide: ContentEditorService, useValue: mock<ContentEditorService>() },
            ],
        }).compile()
        const plans = moduleRef.get(ContentPlansService)

        await expect(plans.apply("ws-1", PLAN)).rejects.toMatchObject({ code: ContentPlansErrorCode.NotWritten })
        expect(tx.rollbacks).toBe(1)
        expect(items.insertPlannedIdeas).not.toHaveBeenCalled()
    })

    it("reads the newest completed plan of the workspace", async () => {
        const { plans, entityManager } = await build()
        const summary = { month: "2026-10-01", ideas: 3, ms: 9, createdAt: new Date("2026-10-01T00:00:00.000Z") }
        const [read] = queueQueryBuilders(entityManager, [{ getRawOne: summary }])

        await expect(plans.last("ws-1")).resolves.toEqual(summary)
        expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(ContentPlanEntity, "pl")
        expect(read?.callsOf("where")).toEqual([
            ["pl.workspace_id = :workspaceId AND pl.status = 'done'", { workspaceId: "ws-1" }],
        ])
        expect(read?.callsOf("limit")).toEqual([[1]])
    })

    it("hands the editor the reader of the newest plan so the page carries it", async () => {
        const { plans, editor, entityManager } = await build()
        const page = mock<Awaited<ReturnType<ContentEditorService["workbench"]>>>()
        editor.workbench.mockResolvedValue(page)
        const summary = { month: "2026-10-01", ideas: 3, ms: 9, createdAt: new Date("2026-10-01T00:00:00.000Z") }
        queueQueryBuilders(entityManager, [{ getRawOne: summary }])

        await expect(plans.workbench("user-1", "ws-1")).resolves.toBe(page)

        const reader = editor.workbench.mock.calls[0]?.[2]
        expect(editor.workbench).toHaveBeenCalledWith("user-1", "ws-1", expect.any(Function))
        await expect(reader?.("ws-1")).resolves.toEqual(summary)
    })
})

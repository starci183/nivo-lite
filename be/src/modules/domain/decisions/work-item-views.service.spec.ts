import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { WorkItemWithCursor } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { contractOf, rowOf } from "@tests/fixtures/builders/work-items.builder"
import { WorkItemViewsService } from "./work-item-views.service"
import type { WorkItemViewFilter } from "./work-item-views.service"

const filterOf = builder<WorkItemViewFilter>({ statuses: [], after: null, action: null, limit: 20 })

const cursorOf = (id: string, leadId: string | null = null, staffId: string | null = null): WorkItemWithCursor => ({
    item: contractOf(rowOf({ id, lead_id: leadId, assigned_staff_id: staffId })),
    cursorAt: `cursor-${id}`,
})

const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = []) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const items = mock<WorkItemsViewsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemViewsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkItemsViewsReadService, useValue: items },
        ],
    }).compile()
    return { service: moduleRef.get(WorkItemViewsService), fakes, items }
}

describe("WorkItemViewsService reads", () => {
    describe("find", () => {
        it("reads one item with its cursor and the name of its latest decider, named twice", async () => {
            const { service, items, fakes } = await build([
                { getRawMany: [{ work_item_id: "work-1", decided_by: "Mai" }] },
            ])
            items.find.mockResolvedValue(cursorOf("work-1"))

            await expect(service.find("workspace-1", "work-1")).resolves.toMatchObject({
                id: "work-1",
                cursor_at: "cursor-work-1",
                decidedBy: "Mai",
                deciderName: "Mai",
            })
            expect(fakes[0]?.callsOf("distinctOn")).toEqual([[["d.workItemId"]]])
        })

        it("answers undefined when the workspace has no such item, and null names without a decision", async () => {
            const { service, items } = await build([{ getRawMany: [] }])

            items.find.mockResolvedValueOnce(null)
            await expect(service.find("workspace-1", "nope")).resolves.toBeUndefined()
            items.find.mockResolvedValueOnce(cursorOf("work-1"))
            await expect(service.find("workspace-1", "work-1")).resolves.toMatchObject({
                decidedBy: null,
                deciderName: null,
            })
        })
    })

    describe("list", () => {
        it("lists a page with each item's decider, and reads no decisions for an empty page", async () => {
            const { service, items, fakes } = await build([
                { getRawMany: [{ work_item_id: "work-1", decided_by: "Mai" }] },
            ])
            items.listPage.mockResolvedValueOnce([cursorOf("work-1"), cursorOf("work-0")])
            items.listPage.mockResolvedValueOnce([])
            const filter = filterOf({ statuses: ["done"] })

            const rows = await service.list("workspace-1", filter)
            await expect(service.list("workspace-1", filter)).resolves.toEqual([])

            expect(rows.map((row) => row.deciderName)).toEqual(["Mai", null])
            expect(items.listPage).toHaveBeenCalledWith("workspace-1", filter)
            expect(fakes).toHaveLength(1)
        })
    })
})

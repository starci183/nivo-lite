import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DashboardRange } from "./work-items-dashboard-read.contracts"
import { WorkItemsDashboardReadService } from "./work-items-dashboard-read.service"
import { WorkItemEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsDashboardReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemsDashboardReadService)
}

/** A manager whose one query builder answers these terminals. */
const answering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

const RANGE: DashboardRange = {
    from: new Date("2026-11-02T17:00:00.000Z"),
    to: new Date("2026-11-09T17:00:00.000Z"),
    previousFrom: new Date("2026-10-26T17:00:00.000Z"),
}

describe("WorkItemsDashboardReadService > activityOf", () => {
    it("reads one grouped statement of the workspace and names the columns the way the dashboard counts them", async () => {
        const { em, fake } = answering({
            getRawMany: [
                {
                    department: "sales",
                    installation_id: null,
                    action: "confirm_order",
                    done: 8,
                    auto_done: 6,
                    failed: 1,
                    previous_done: 5,
                    previous_auto_done: 5,
                },
            ],
        })
        const service = await build(em)

        const rows = await service.activityOf("ws-1", RANGE)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(rows).toEqual([
            {
                department: "sales",
                installationId: null,
                action: "confirm_order",
                done: 8,
                autoDone: 6,
                failed: 1,
                previousDone: 5,
                previousAutoDone: 5,
            },
        ])
        expect(fake.callsOf("groupBy")).toEqual([["w.department"]])
        expect(fake.callsOf("addGroupBy")).toEqual([["w.installation_id"], ["w.action"]])
        expect(fake.callsOf("setParameters")).toEqual([
            [{ from: RANGE.from, to: RANGE.to, previousFrom: RANGE.previousFrom }],
        ])
    })
})

describe("WorkItemsDashboardReadService > responseTimesOf", () => {
    it("answers the median per agent and keeps a null median", async () => {
        const { em } = answering({
            getRawMany: [
                { department: "chatbot", installation_id: "i-1", median_seconds: 12.5 },
                { department: "sales", installation_id: null, median_seconds: null },
            ],
        })
        const service = await build(em)

        await expect(service.responseTimesOf("ws-1", RANGE)).resolves.toEqual([
            { department: "chatbot", installationId: "i-1", medianSeconds: 12.5 },
            { department: "sales", installationId: null, medianSeconds: null },
        ])
    })
})

describe("WorkItemsDashboardReadService > waitingOf", () => {
    it("counts the items waiting for a decision per agent", async () => {
        const { em } = answering({ getRawMany: [{ department: "sales", installation_id: null, waiting: 3 }] })
        const service = await build(em)

        await expect(service.waitingOf("ws-1")).resolves.toEqual([
            { department: "sales", installationId: null, waiting: 3 },
        ])
    })
})

describe("WorkItemsDashboardReadService > waitingApprovalsOf", () => {
    it("reads the oldest waiting items with the total before the limit", async () => {
        const { em, fake } = answering({
            getRawMany: [
                {
                    id: "w-1",
                    department: "sales",
                    installation_id: null,
                    action: "confirm_order",
                    created_at: "2026-11-09T01:00:00.000Z",
                    summary: "Order DH-1",
                    customer: null,
                    total: 5,
                },
            ],
        })
        const service = await build(em)

        const waiting = await service.waitingApprovalsOf("ws-1", 4)

        expect(waiting.total).toBe(5)
        expect(waiting.items).toEqual([
            {
                id: "w-1",
                department: "sales",
                installationId: null,
                action: "confirm_order",
                createdAt: "2026-11-09T01:00:00.000Z",
                summary: "Order DH-1",
                customer: null,
            },
        ])
        expect(fake.callsOf("limit")).toEqual([[4]])
    })

    it("answers zero when nothing waits", async () => {
        const { em } = answering({ getRawMany: [] })
        const service = await build(em)

        await expect(service.waitingApprovalsOf("ws-1", 4)).resolves.toEqual({ total: 0, items: [] })
    })
})

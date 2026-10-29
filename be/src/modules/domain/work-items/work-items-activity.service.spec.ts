import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DashboardListQuery } from "./work-items-activity.contracts"
import { WorkItemsActivityService } from "./work-items-activity.service"
import { WorkItemEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsActivityService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemsActivityService)
}

/** A manager whose one query builder answers these terminals. */
const answering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

const LIST: DashboardListQuery = {
    workspaceId: "ws",
    department: "sales",
    installationId: null,
    kind: "waiting",
    since: null,
    testRunPattern: "UAT|DBG",
    limit: 10,
}

describe("WorkItemsActivityService > recentOf", () => {
    it("reads the department's newest work, bounded", async () => {
        const rows = [
            {
                id: "w1",
                action: "send_follow_up",
                status: "done",
                at: "x",
                summary: null,
                customer: null,
                leadId: null,
            },
        ]
        const { em, fake } = answering({ getRawMany: rows })

        await expect((await build(em)).recentOf("ws", "sales", 6)).resolves.toEqual(rows)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(fake.callsOf("where")).toEqual([
            ["w.workspaceId = :workspaceId AND w.department = :department", { workspaceId: "ws", department: "sales" }],
        ])
        expect(fake.callsOf("limit")).toEqual([[6]])
    })
})

describe("WorkItemsActivityService > dashboardList", () => {
    it("lists the items waiting for a decision, oldest first, over the whole department", async () => {
        const { em, fake } = answering({ getRawMany: [{ id: "w1", total: "1" }] })

        await expect((await build(em)).dashboardList(LIST)).resolves.toEqual([{ id: "w1", total: "1" }])
        expect(fake.callsOf("andWhere").map((call) => call[0])).toEqual([
            expect.stringContaining("NOT (concat_ws"),
            "w.status = 'waiting_decision'",
        ])
        expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ pattern: "UAT|DBG" })
        expect(fake.callsOf("orderBy")).toEqual([["w.createdAt", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[10]])
    })

    it("narrows a waiting list to its instance", async () => {
        const { em, fake } = answering({ getRawMany: [] })

        await (await build(em)).dashboardList({ ...LIST, installationId: "inst-1" })

        expect(fake.callsOf("andWhere")[1]).toEqual(["w.installationId = :scopeId", { scopeId: "inst-1" }])
    })

    it("lists the items done by themselves since a moment, newest first", async () => {
        const since = new Date("2026-10-01T00:00:00.000Z")
        const { em, fake } = answering({ getRawMany: [] })

        await (await build(em)).dashboardList({ ...LIST, kind: "done", since })

        expect(fake.callsOf("andWhere")[1]).toEqual([
            "w.status = 'done' AND w.decidedPath = 'auto' AND w.completedAt >= :since",
            { since },
        ])
        expect(fake.callsOf("orderBy")).toEqual([["w.completedAt", "DESC"]])
    })
})

describe("WorkItemsActivityService > waitingReplies", () => {
    it("reads the customer replies waiting for a decision, oldest first, bounded", async () => {
        const rows = [{ id: "w1", subject_id: "c1", proposal: null, assigned_staff_id: null, created_at: "x" }]
        const { em, fake } = answering({ getRawMany: rows })

        await expect((await build(em)).waitingReplies("ws", 200)).resolves.toEqual(rows)
        expect(fake.callsOf("orderBy")).toEqual([["w.created_at"]])
        expect(fake.callsOf("limit")).toEqual([[200]])
    })
})

describe("WorkItemsActivityService > answerProgress", () => {
    it("answers how far the reply got and what was delivered", async () => {
        const row = { id: "w1", work_status: "done", message_id: "m1", delivery_status: "sent" }
        const { em, fake } = answering({ getRawOne: row })

        await expect((await build(em)).answerProgress("ws", "w1")).resolves.toEqual(row)
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws", workItemId: "w1" })
        expect(fake.callsOf("limit")).toEqual([[1]])
    })

    it("answers null when the workspace has no such reply", async () => {
        const { em } = answering({ getRawOne: undefined })

        await expect((await build(em)).answerProgress("ws", "ghost")).resolves.toBeNull()
    })
})

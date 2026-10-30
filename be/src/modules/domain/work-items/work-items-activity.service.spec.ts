import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DashboardListQuery } from "./work-items-activity.contracts"
import { WORK_ITEMS_LEADS } from "./work-items.decorators"
import type { WorkItemsLeadDirectory } from "./work-items.port"
import { WorkItemsActivityService } from "./work-items-activity.service"
import { WorkItemEntity } from "./persistence/entities"

const buildWith = async (entityManager: MockEntityManager) => {
    const leads = mock<WorkItemsLeadDirectory>()
    leads.cardsOf.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemsActivityService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WORK_ITEMS_LEADS, useValue: leads },
        ],
    }).compile()
    return { service: moduleRef.get(WorkItemsActivityService), leads }
}

const build = async (entityManager: MockEntityManager) => (await buildWith(entityManager)).service

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

const CARD = { id: "lead-1", contactName: "Minh An", company: "Hoa Viet", channel: "web", stage: "new", email: null }

/** One item as the lists read it before the lead's name is folded in. */
const lineOf = (changes: Record<string, unknown> = {}) => ({
    id: "w1",
    action: "send_follow_up",
    leadId: null,
    at: "2026-10-12T09:00:00.000Z",
    summary: "Close the booking",
    resultHref: null,
    proposalSummary: "Close the booking",
    proposalContact: null,
    proposalCustomer: "Proposal customer",
    status: "done",
    ...changes,
})

describe("WorkItemsActivityService > recentOf", () => {
    it("reads the department's newest work, bounded, and names the customer after the lead", async () => {
        const { em, fake } = answering({ getRawMany: [lineOf({ leadId: "lead-1" }), lineOf({ id: "w2" })] })
        const { service, leads } = await buildWith(em)
        leads.cardsOf.mockResolvedValue([CARD])

        const lines = await service.recentOf("ws", "sales", 6)

        expect(lines.map((line) => line.customer)).toEqual(["Minh An", "Proposal customer"])
        expect(lines[0]).toEqual({
            id: "w1",
            action: "send_follow_up",
            status: "done",
            at: "2026-10-12T09:00:00.000Z",
            summary: "Close the booking",
            customer: "Minh An",
            leadId: "lead-1",
        })
        expect(leads.cardsOf).toHaveBeenCalledWith("ws", ["lead-1"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(fake.callsOf("where")).toEqual([
            ["w.workspaceId = :workspaceId AND w.department = :department", { workspaceId: "ws", department: "sales" }],
        ])
        expect(fake.callsOf("limit")).toEqual([[6]])
    })

    it("defaults a missing status to queued", async () => {
        const { em } = answering({ getRawMany: [lineOf({ status: undefined })] })
        const { service } = await buildWith(em)

        await expect(service.recentOf("ws", "sales", 6)).resolves.toMatchObject([{ status: "queued" }])
    })
})

describe("WorkItemsActivityService > dashboardList", () => {
    it("lists the items waiting for a decision, oldest first, over the whole department", async () => {
        const { em, fake } = answering({ getRawMany: [lineOf({ resultHref: undefined })] })
        const { service } = await buildWith(em)

        await expect(service.dashboardList(LIST)).resolves.toEqual([
            {
                id: "w1",
                action: "send_follow_up",
                leadId: null,
                at: "2026-10-12T09:00:00.000Z",
                summary: "Close the booking",
                customer: "Proposal customer",
                resultHref: null,
                total: "1",
            },
        ])
        expect(fake.callsOf("andWhere")).toEqual([["w.status = 'waiting_decision'"]])
        expect(fake.callsOf("orderBy")).toEqual([["w.createdAt", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[500]])
    })

    it("leaves test runs out, in the lead or in the proposal, and counts the rest", async () => {
        const { em } = answering({
            getRawMany: [
                lineOf({ id: "keep" }),
                lineOf({ id: "lead-test", leadId: "lead-1" }),
                lineOf({ id: "proposal-test", proposalSummary: "UAT run" }),
                lineOf({ id: "keep-2", proposalSummary: null, proposalCustomer: null }),
            ],
        })
        const { service, leads } = await buildWith(em)
        leads.cardsOf.mockResolvedValue([{ ...CARD, contactName: "DBG visitor" }])

        const lines = await service.dashboardList({ ...LIST, limit: 1 })

        expect(lines.map((line) => line.id)).toEqual(["keep"])
        expect(lines[0]?.total).toBe("2")
    })

    it("narrows a waiting list to its instance", async () => {
        const { em, fake } = answering({ getRawMany: [] })
        const { service } = await buildWith(em)

        await service.dashboardList({ ...LIST, installationId: "inst-1" })

        expect(fake.callsOf("andWhere")[0]).toEqual(["w.installationId = :scopeId", { scopeId: "inst-1" }])
    })

    it("lists the items done by themselves since a moment, newest first, with the result link", async () => {
        const since = new Date("2026-10-01T00:00:00.000Z")
        const { em, fake } = answering({ getRawMany: [lineOf({ resultHref: "/leads/l1" })] })
        const { service } = await buildWith(em)

        await expect(service.dashboardList({ ...LIST, kind: "done", since })).resolves.toMatchObject([
            { resultHref: "/leads/l1" },
        ])
        expect(fake.callsOf("andWhere")[0]).toEqual([
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

describe("WorkItemsActivityService > waitingSummaries", () => {
    it("lists the summaries of the items waiting for a decision, oldest first, bounded", async () => {
        const { em, fake } = answering({ getRawMany: [{ summary: "Quote" }, { summary: null }] })

        await expect((await build(em)).waitingSummaries("ws", 50)).resolves.toEqual(["Quote", null])
        expect(fake.callsOf("orderBy")).toEqual([["w.created_at", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[50]])
    })

    it("reads through the manager it is handed", async () => {
        const own = mockEntityManager()
        const { em: handed } = answering({ getRawMany: [] })

        await (await build(own)).waitingSummaries("ws", 5, handed)

        expect(own.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("WorkItemsActivityService > builtInCareOf", () => {
    it("answers the work item of the care message the gate sent or holds", async () => {
        const { em, fake } = answering({ getRawOne: { id: "w1" } })

        await expect((await build(em)).builtInCareOf("ws", "lead-1", "2026-10-01")).resolves.toBe("w1")
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws", leadId: "lead-1" })
        expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ since: "2026-10-01" })
    })

    it("answers null when there is none, reading through the manager it is handed", async () => {
        const own = mockEntityManager()
        const { em: handed } = answering({ getRawOne: undefined })

        await expect((await build(own)).builtInCareOf("ws", "lead-1", "2026-10-01", handed)).resolves.toBeNull()
        expect(own.createQueryBuilder).not.toHaveBeenCalled()
    })
})

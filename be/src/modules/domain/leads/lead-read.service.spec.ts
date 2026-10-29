import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { ILike, In } from "typeorm"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LeadsErrorCode } from "./errors/leads.error"
import type { LeadView } from "./lead-read.contracts"
import { LeadReadService } from "./lead-read.service"
import { LeadEntity } from "./persistence/entities"
import { normalizePage } from "@modules/platform/pagination"
import { HttpSecurityErrorCode } from "@modules/platform/http-security"

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "An",
    company: "ACME",
    channel: "Zalo",
    need: "price",
    stage: "new",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-12T03:00:00.000Z",
}

const PAGE_LEAD: LeadView = {
    ...LEAD,
    id: "00000000-0000-4000-8000-000000000002",
    created_at: "2026-10-12T03:00:00.123456+00:00",
}

const NEXT_LEAD: LeadView = { ...PAGE_LEAD, id: "00000000-0000-4000-8000-000000000001" }

/** A service over a manager that hands out one query builder per read, answering `answers` in order. */
const build = async (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { leads: moduleRef.get(LeadReadService), em, fakes }
}

const rows = (list: ReadonlyArray<LeadView>): QueryBuilderAnswers => ({ getRawMany: list })

const registerPageReads = () => {
    it("reads one extra lead to establish continuation and preserves the exact timestamp and id", async () => {
        const { leads, fakes } = await build([rows([PAGE_LEAD, NEXT_LEAD])])

        const result = await leads.listPage("ws-1", { first: 1 })

        expect(result.nodes).toEqual([PAGE_LEAD])
        expect(result.pageInfo.hasNextPage).toBe(true)
        expect(normalizePage({ after: result.pageInfo.endCursor }, "leadBoard:ws-1").after).toEqual({
            createdAt: PAGE_LEAD.created_at,
            id: PAGE_LEAD.id,
        })
        expect(fakes[0]?.callsOf("limit")).toEqual([[2]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([])
        expect(fakes[0]?.callsOf("where")).toEqual([["l.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
    })

    it("passes the exact cursor boundary into the next scoped database read", async () => {
        const { leads, fakes } = await build([rows([PAGE_LEAD, NEXT_LEAD]), rows([])])
        const first = await leads.listPage("ws-1", { first: 1 })

        await leads.listPage("ws-1", { first: 1, after: first.pageInfo.endCursor })

        expect(fakes[1]?.callsOf("andWhere")).toEqual([
            [
                "(l.created_at, l.id) < (CAST(:after AS timestamptz), CAST(:afterId AS uuid))",
                { after: PAGE_LEAD.created_at, afterId: PAGE_LEAD.id },
            ],
        ])
        expect(fakes[1]?.callsOf("limit")).toEqual([[2]])
        expect(fakes[1]?.callsOf("orderBy")).toEqual([["l.created_at", "DESC"]])
        expect(fakes[1]?.callsOf("addOrderBy")).toEqual([["l.id", "DESC"]])
    })

    it("uses the shared bounded default and answers an empty final page", async () => {
        const { leads, fakes } = await build([rows([])])

        await expect(leads.listPage("ws-1", {})).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(fakes[0]?.callsOf("limit")).toEqual([[51]])
    })
}

const registerPageRefusals = () => {
    it("refuses an oversized page before reading leads", async () => {
        const { leads, em } = await build([])

        await expect(leads.listPage("ws-1", { first: 101 })).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses another workspace's cursor before reading leads", async () => {
        const { leads, em } = await build([rows([PAGE_LEAD, NEXT_LEAD])])
        const first = await leads.listPage("ws-1", { first: 1 })
        em.createQueryBuilder.mockClear()

        await expect(leads.listPage("ws-2", { after: first.pageInfo.endCursor })).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
}

describe("LeadReadService", () => {
    it("lists the recent leads of the workspace, the creation time as ISO text", async () => {
        const { leads, em, fakes } = await build([rows([LEAD])])

        await expect(leads.list("ws-1")).resolves.toEqual([LEAD])

        expect(em.createQueryBuilder).toHaveBeenCalledWith(LeadEntity, "l")
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual(["to_json(l.created_at) #>> '{}'", "created_at"])
        expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
    })

    registerPageReads()
    registerPageRefusals()

    it("reads the newest leads as names, newest first, bounded", async () => {
        const { leads, em } = await build([])
        em.find.mockResolvedValueOnce([{ id: "l-1", contactName: "Minh", company: "Tea", stage: "new" }])

        await expect(leads.recentNames("ws-1", 300)).resolves.toEqual([
            { id: "l-1", contactName: "Minh", company: "Tea" },
        ])

        expect(em.find).toHaveBeenCalledWith(LeadEntity, {
            select: { id: true, contactName: true, company: true },
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC", id: "DESC" },
            take: 300,
        })
    })

    it("tells whether the workspace has a lead with the id", async () => {
        const { leads, em } = await build([])
        em.exists.mockResolvedValueOnce(true)

        await expect(leads.exists("ws-1", "l-1")).resolves.toBe(true)

        expect(em.exists).toHaveBeenCalledWith(LeadEntity, { where: { workspaceId: "ws-1", id: "l-1" } })
    })

    it("answers no rows when the id list is empty", async () => {
        const { leads, em } = await build([])

        await expect(leads.listByIds("ws-1", [])).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads the requested leads", async () => {
        const { leads } = await build([rows([LEAD])])

        await expect(leads.listByIds("ws-1", ["lead-1"])).resolves.toEqual([LEAD])
    })

    it("refuses a lead the workspace does not have", async () => {
        const { leads } = await build([{ getRawOne: undefined }])

        await expect(leads.require("ws-1", "missing")).rejects.toMatchObject({
            code: LeadsErrorCode.NotFound,
            params: { id: "missing" },
        })
    })

    it("requires the requested lead within its workspace", async () => {
        const { leads, fakes } = await build([{ getRawOne: LEAD }])

        await expect(leads.require("ws-1", "lead-1")).resolves.toEqual(LEAD)

        expect(fakes[0]?.callsOf("where")).toEqual([["l.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.id = :leadId", { leadId: "lead-1" }]])
    })

    it("scopes a bounded id lookup to the workspace and requested ids", async () => {
        const { leads, fakes } = await build([rows([LEAD])])
        const ids = ["lead-1", "lead-older"]

        await expect(leads.listByIds("ws-1", ids)).resolves.toEqual([LEAD])

        expect(fakes[0]?.callsOf("where")).toEqual([["l.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.id = ANY(:leadIds)", { leadIds: ids }]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1000]])
    })
})

describe("LeadReadService dashboard reads", () => {
    const leadOf = entityOf(LeadEntity, {
        id: "lead-1",
        workspaceId: "ws-1",
        contactName: "An",
        company: "ACME",
        channel: "Website chat",
        need: "price",
        stage: "new",
        phone: "0900",
        email: "an@example.com",
        createdAt: new Date("2026-10-12T03:00:00.000Z"),
    })

    const buildWith = async (em: ReturnType<typeof mockEntityManager>) => {
        const moduleRef = await Test.createTestingModule({
            providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        return moduleRef.get(LeadReadService)
    }

    it("answers the cards of the given leads and asks nothing for no ids", async () => {
        const em = mockEntityManager({ find: [LeadEntity, [leadOf()]] })
        const service = await buildWith(em)

        await expect(service.cardsOf("ws-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(service.cardsOf("ws-1", ["lead-1", "lead-1"])).resolves.toEqual([
            {
                id: "lead-1",
                contactName: "An",
                company: "ACME",
                channel: "Website chat",
                stage: "new",
                email: "an@example.com",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(LeadEntity, {
            select: { id: true, contactName: true, company: true, channel: true, stage: true, email: true },
            where: { workspaceId: "ws-1", id: In(["lead-1"]) },
        })
    })

    it("counts the leads created inside a window", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getCount: 4 }])
        const from = new Date("2026-10-12T00:00:00.000Z")
        const to = new Date("2026-10-13T00:00:00.000Z")

        await expect((await buildWith(em)).countCreatedBetween("ws-1", from, to)).resolves.toBe(4)
        expect(fake?.callsOf("where")).toEqual([
            [
                "l.workspaceId = :workspaceId AND l.createdAt >= :from AND l.createdAt < :to",
                { workspaceId: "ws-1", from, to },
            ],
        ])
    })

    it("lists the website leads", async () => {
        const em = mockEntityManager({ find: [LeadEntity, [leadOf()]] })

        await expect((await buildWith(em)).websiteOf("ws-1")).resolves.toEqual([
            { id: "lead-1", createdAt: new Date("2026-10-12T03:00:00.000Z") },
        ])
        expect(em.find).toHaveBeenCalledWith(LeadEntity, {
            select: { id: true, createdAt: true },
            where: { workspaceId: "ws-1", channel: ILike("%website%") },
        })
    })

    it("lists the ids of the leads at one stage", async () => {
        const em = mockEntityManager({ find: [LeadEntity, [leadOf({ stage: "won" })]] })

        await expect((await buildWith(em)).idsAtStage("ws-1", "won")).resolves.toEqual(["lead-1"])
        expect(em.find).toHaveBeenCalledWith(LeadEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", stage: "won" },
        })
    })

    it("summarises the leads of the workspace, bounded", async () => {
        const em = mockEntityManager({ find: [LeadEntity, [leadOf()]] })

        await expect((await buildWith(em)).summariesOf("ws-1", 10)).resolves.toEqual([
            {
                id: "lead-1",
                contactName: "An",
                company: "ACME",
                stage: "new",
                createdAt: new Date("2026-10-12T03:00:00.000Z"),
            },
        ])
        expect(em.find).toHaveBeenCalledWith(LeadEntity, {
            select: { id: true, contactName: true, company: true, stage: true, createdAt: true },
            where: { workspaceId: "ws-1" },
            take: 10,
        })
    })

    it("lists the leads for the API newest first, with a stage filter only when one is given", async () => {
        const em = mockEntityManager()
        const fakes = queueQueryBuilders(em, [{ getMany: [leadOf()] }, { getMany: [] }])
        const service = await buildWith(em)

        await expect(service.listForApi("ws-1", "new", 5)).resolves.toEqual([
            {
                id: "lead-1",
                contactName: "An",
                company: "ACME",
                channel: "Website chat",
                need: "price",
                stage: "new",
                phone: "0900",
                email: "an@example.com",
                createdAt: new Date("2026-10-12T03:00:00.000Z"),
            },
        ])
        await expect(service.listForApi("ws-1", null, 5)).resolves.toEqual([])

        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.stage = :stage", { stage: "new" }]])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["l.createdAt", "DESC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[5]])
        expect(fakes[1]?.callsOf("andWhere")).toEqual([])
    })
})

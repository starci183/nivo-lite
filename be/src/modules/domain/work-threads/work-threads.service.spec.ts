import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { normalizePage } from "@modules/platform/pagination"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkThreadsErrorCode } from "./errors/work-threads.error"
import { WorkThreadEntity } from "./persistence/entities"
import { THREAD_COLUMNS, THREAD_RETURNING } from "./persistence/work-thread.query"
import { WorkThreadsService } from "./work-threads.service"
import type { WorkThreadRecord } from "./work-threads.contracts"

const threadRow: WorkThreadRecord = {
    id: "thread-1",
    workspace_id: "ws-1",
    title: "Villa booking for Ms Thao",
    lead_id: "lead-1",
    order_id: null,
    status: "open",
    created_by: "member-van",
    created_at: "2026-10-22T09:41:00+07:00",
    updated_at: "2026-10-22T09:41:00+07:00",
}

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkThreadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(WorkThreadsService)
}

/** A manager double that hands out one fake query builder per `createQueryBuilder` call, in order. */
const managerOf = (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) em.createQueryBuilder.mockReturnValueOnce(fake.builder as never)
    return { em, fakes }
}

/** A manager double whose every query builder is the same one. */
const managerWith = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder as never)
    return { em, fake }
}

const input = {
    workspaceId: "ws-1",
    memberId: "member-van",
    title: "Villa booking for Ms Thao",
    leadId: null,
    orderId: null,
}

const registerCreateFor = () => {
    describe("createFor", () => {
        it("opens a thread for a member id and answers it from the insert itself", async () => {
            const { em, fake } = managerWith({ execute: { raw: [threadRow] } })
            const service = await build(em)

            const thread = await service.createFor(input)

            expect(thread).toMatchObject({ id: "thread-1", status: "open", createdBy: "member-van" })
            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkThreadEntity, "w")
            expect(fake.callsOf("insert")).toEqual([[]])
            expect(fake.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        title: "Villa booking for Ms Thao",
                        leadId: null,
                        orderId: null,
                        createdBy: "member-van",
                    },
                ],
            ])
            expect(fake.callsOf("returning")).toEqual([[THREAD_RETURNING]])
        })

        it("opens a thread about a lead and an order of the workspace inside the transaction of the caller", async () => {
            const em = mockEntityManager()
            const other = managerOf([
                { getRawOne: { id: "lead-1" } },
                { getRawOne: { id: "order-1" } },
                { execute: { raw: [threadRow] } },
            ])
            const service = await build(em)

            await service.createFor({ ...input, leadId: "lead-1", orderId: "order-1" }, other.em)

            const [leadRead, orderRead, insert] = other.fakes
            expect(leadRead?.callsOf("from")).toEqual([["public.leads", "x"]])
            expect(leadRead?.callsOf("where")).toEqual([
                ["x.workspace_id = :workspaceId AND x.id = :id", { workspaceId: "ws-1", id: "lead-1" }],
            ])
            expect(orderRead?.callsOf("from")).toEqual([["public.orders", "x"]])
            expect(insert?.callsOf("values")[0]?.[0]).toMatchObject({ leadId: "lead-1", orderId: "order-1" })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("refuses a lead that is not in the workspace", async () => {
            const service = await build(managerWith({ getRawOne: undefined }).em)

            await expect(service.createFor({ ...input, leadId: "lead-9" })).rejects.toMatchObject({
                code: WorkThreadsErrorCode.LeadNotFound,
            })
        })

        it("refuses an order that is not in the workspace", async () => {
            const service = await build(managerWith({ getRawOne: undefined }).em)

            await expect(service.createFor({ ...input, orderId: "order-9" })).rejects.toMatchObject({
                code: WorkThreadsErrorCode.OrderNotFound,
            })
        })

        it("refuses a thread the insert did not answer", async () => {
            const service = await build(managerWith({ execute: { raw: [] } }).em)

            await expect(service.createFor(input)).rejects.toMatchObject({ code: WorkThreadsErrorCode.NotStored })
        })
    })
}

const registerReads = () => {
    describe("find and lock", () => {
        it("finds a thread of the workspace with the instants as database text", async () => {
            const { em, fake } = managerWith({ getRawOne: threadRow })
            const service = await build(em)

            await expect(service.find("ws-1", "thread-1")).resolves.toMatchObject({ id: "thread-1" })
            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkThreadEntity, "t")
            expect(fake.callsOf("select")).toEqual([[[...THREAD_COLUMNS]]])
            expect(fake.callsOf("where")).toEqual([["t.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
            expect(fake.callsOf("andWhere")).toEqual([["t.id = :threadId", { threadId: "thread-1" }]])
            expect(fake.callsOf("setLock")).toEqual([])
        })

        it("refuses a thread that is not in the workspace", async () => {
            const service = await build(managerWith({ getRawOne: undefined }).em)

            await expect(service.find("ws-1", "thread-9")).rejects.toMatchObject({
                code: WorkThreadsErrorCode.ThreadNotFound,
            })
        })

        it("locks a thread for the transaction of the caller", async () => {
            const { em, fake } = managerWith({ getRawOne: threadRow })
            const service = await build(mockEntityManager())

            await expect(service.lock(em, "ws-1", "thread-1")).resolves.toMatchObject({ id: "thread-1" })
            expect(fake.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(fake.callsOf("andWhere")).toEqual([["t.id = :threadId", { threadId: "thread-1" }]])
        })

        it("refuses to lock a thread that is not in the workspace", async () => {
            const { em } = managerWith({ getRawOne: undefined })
            const service = await build(mockEntityManager())

            await expect(service.lock(em, "ws-1", "thread-9")).rejects.toMatchObject({
                code: WorkThreadsErrorCode.ThreadNotFound,
            })
        })
    })
}

const registerPagination = () => {
    describe("list", () => {
        it("lists the newest threads, optionally only those about one lead", async () => {
            const { em, fake } = managerWith({ getRawMany: [threadRow] })
            const service = await build(em)

            const threads = await service.list("ws-1", "lead-1")

            expect(threads.nodes.map((thread) => thread.id)).toEqual(["thread-1"])
            const endCursor = Buffer.from(
                JSON.stringify({
                    v: 1,
                    scope: "ws-1:workThreads:lead-1",
                    createdAt: threadRow.created_at,
                    id: threadRow.id,
                }),
            ).toString("base64url")
            expect(threads.pageInfo).toEqual({ hasNextPage: false, endCursor })
            expect(fake.callsOf("andWhere")).toEqual([["t.lead_id = :leadId", { leadId: "lead-1" }]])
            expect(fake.callsOf("orderBy")).toEqual([["t.created_at", "DESC"]])
            expect(fake.callsOf("addOrderBy")).toEqual([["t.id", "DESC"]])
            expect(fake.callsOf("limit")).toEqual([[51]])
        })

        it("continues after the full database instant and id without exposing the lookahead row", async () => {
            const row = {
                ...threadRow,
                id: "00000000-0000-4000-8000-000000000002",
                created_at: "2026-10-22T02:41:00.123456+00:00",
            }
            const older = { ...row, id: "00000000-0000-4000-8000-000000000001" }
            const { em, fake } = managerWith({ getRawMany: [row, older] })
            const service = await build(em)

            const first = await service.list("ws-1", null, { first: 1 })

            expect(first.nodes.map((thread) => thread.id)).toEqual([row.id])
            expect(first.pageInfo.hasNextPage).toBe(true)
            expect(normalizePage({ after: first.pageInfo.endCursor }, "ws-1:workThreads:all").after).toEqual({
                createdAt: row.created_at,
                id: row.id,
            })

            await service.list("ws-1", null, { first: 1, after: first.pageInfo.endCursor })

            expect(fake.callsOf("andWhere")).toEqual([
                [
                    "(t.created_at, t.id) < (CAST(:cursorAt AS timestamptz), CAST(:cursorId AS uuid))",
                    { cursorAt: row.created_at, cursorId: row.id },
                ],
            ])
            expect(fake.callsOf("limit")).toEqual([[2], [2]])
        })

        it("refuses a cursor from another lead filter before reading rows", async () => {
            const row = { ...threadRow, id: "00000000-0000-4000-8000-000000000001" }
            const { em } = managerWith({ getRawMany: [row] })
            const service = await build(em)
            const page = await service.list("ws-1", "lead-1", { first: 1 })
            em.createQueryBuilder.mockClear()

            await expect(service.list("ws-1", null, { after: page.pageInfo.endCursor })).rejects.toThrow()

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it.each([null, undefined])("normalizes an absent lead filter %p to an unfiltered query", async (leadId) => {
            const { em, fake } = managerWith({ getRawMany: [] })
            const service = await build(em)

            await expect(service.list("ws-1", leadId)).resolves.toEqual({
                nodes: [],
                pageInfo: { endCursor: null, hasNextPage: false },
            })

            expect(fake.callsOf("andWhere")).toEqual([])
            expect(fake.callsOf("limit")).toEqual([[51]])
        })
    })
}

const registerStatus = () => {
    describe("setStatus", () => {
        it("sets where a thread stands and marks it changed inside the transaction of the caller", async () => {
            const em = mockEntityManager({ update: [WorkThreadEntity, { affected: 1, raw: [], generatedMaps: [] }] })
            const service = await build(mockEntityManager())

            await service.setStatus(em, "ws-1", "thread-1", "waiting")

            expect(em.update.mock.calls[0]?.slice(0, 2)).toEqual([
                WorkThreadEntity,
                { workspaceId: "ws-1", id: "thread-1" },
            ])
            expect(evaluatedValues(em.update.mock.calls[0]?.[2])).toEqual({ status: "waiting", updatedAt: "now()" })
        })
    })
}

describe("WorkThreadsService", () => {
    registerCreateFor()
    registerReads()
    registerPagination()
    registerStatus()
})

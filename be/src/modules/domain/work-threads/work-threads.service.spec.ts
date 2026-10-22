import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkThreadsErrorCode } from "./errors/work-threads.error"
import type { ThreadRow } from "./persistence/work-threads.rows"
import {
    FIND_LEAD,
    FIND_ORDER,
    FIND_THREAD,
    INSERT_THREAD,
    LIST_THREADS,
    LOCK_THREAD,
    SET_THREAD_STATUS,
} from "./persistence/work-threads.sql"
import { WorkThreadsService } from "./work-threads.service"

const threadRow: ThreadRow = {
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

const input = {
    workspaceId: "ws-1",
    memberId: "member-van",
    title: "Villa booking for Ms Thao",
    leadId: null,
    orderId: null,
}

const registerCreateFor = () => {
    describe("createFor", () => {
        it("opens a thread for a member id", async () => {
            const em = mockEntityManager({ query: [INSERT_THREAD, [threadRow]] })
            const service = await build(em)

            const thread = await service.createFor(input)

            expect(thread).toMatchObject({ id: "thread-1", status: "open", createdBy: "member-van" })
            expect(em.query).toHaveBeenCalledWith(INSERT_THREAD, [
                "ws-1",
                "Villa booking for Ms Thao",
                null,
                null,
                "member-van",
            ])
        })

        it("opens a thread about a lead and an order of the workspace inside the transaction of the caller", async () => {
            const em = mockEntityManager({ query: [INSERT_THREAD, [threadRow]] })
            const other = mockEntityManager({
                query: [
                    [FIND_LEAD, [{ id: "lead-1" }]],
                    [FIND_ORDER, [{ id: "order-1" }]],
                    [INSERT_THREAD, [threadRow]],
                ],
            })
            const service = await build(em)

            await service.createFor({ ...input, leadId: "lead-1", orderId: "order-1" }, other)

            expect(other.query).toHaveBeenCalledWith(INSERT_THREAD, [
                "ws-1",
                "Villa booking for Ms Thao",
                "lead-1",
                "order-1",
                "member-van",
            ])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a lead that is not in the workspace", async () => {
            const service = await build(mockEntityManager({ query: [FIND_LEAD, []] }))

            await expect(service.createFor({ ...input, leadId: "lead-9" })).rejects.toMatchObject({
                code: WorkThreadsErrorCode.LeadNotFound,
            })
        })

        it("refuses an order that is not in the workspace", async () => {
            const service = await build(mockEntityManager({ query: [FIND_ORDER, []] }))

            await expect(service.createFor({ ...input, orderId: "order-9" })).rejects.toMatchObject({
                code: WorkThreadsErrorCode.OrderNotFound,
            })
        })

        it("refuses a thread the insert did not answer", async () => {
            const service = await build(mockEntityManager({ query: [INSERT_THREAD, []] }))

            await expect(service.createFor(input)).rejects.toMatchObject({ code: WorkThreadsErrorCode.NotStored })
        })
    })
}

const registerReads = () => {
    describe("find, list and lock", () => {
        it("finds a thread of the workspace", async () => {
            const em = mockEntityManager({ query: [FIND_THREAD, [threadRow]] })
            const service = await build(em)

            await expect(service.find("ws-1", "thread-1")).resolves.toMatchObject({ id: "thread-1" })
            expect(em.query).toHaveBeenCalledWith(FIND_THREAD, ["ws-1", "thread-1"])
        })

        it("refuses a thread that is not in the workspace", async () => {
            const service = await build(mockEntityManager({ query: [FIND_THREAD, []] }))

            await expect(service.find("ws-1", "thread-9")).rejects.toMatchObject({
                code: WorkThreadsErrorCode.ThreadNotFound,
            })
        })

        it("lists the newest threads, optionally only those about one lead", async () => {
            const em = mockEntityManager({ query: [LIST_THREADS, [threadRow]] })
            const service = await build(em)

            const threads = await service.list("ws-1", "lead-1")

            expect(threads.map((thread) => thread.id)).toEqual(["thread-1"])
            expect(em.query).toHaveBeenCalledWith(LIST_THREADS, ["ws-1", "lead-1"])
        })

        it("locks a thread for the transaction of the caller", async () => {
            const em = mockEntityManager({ query: [LOCK_THREAD, [threadRow]] })
            const service = await build(mockEntityManager())

            await expect(service.lock(em, "ws-1", "thread-1")).resolves.toMatchObject({ id: "thread-1" })
            expect(em.query).toHaveBeenCalledWith(LOCK_THREAD, ["ws-1", "thread-1"])
        })

        it("refuses to lock a thread that is not in the workspace", async () => {
            const em = mockEntityManager({ query: [LOCK_THREAD, []] })
            const service = await build(mockEntityManager())

            await expect(service.lock(em, "ws-1", "thread-9")).rejects.toMatchObject({
                code: WorkThreadsErrorCode.ThreadNotFound,
            })
        })
    })
}

const registerStatus = () => {
    describe("setStatus", () => {
        it("sets where a thread stands inside the transaction of the caller", async () => {
            const em = mockEntityManager({ query: [SET_THREAD_STATUS, []] })
            const service = await build(mockEntityManager())

            await service.setStatus(em, "ws-1", "thread-1", "waiting")

            expect(em.query).toHaveBeenCalledWith(SET_THREAD_STATUS, ["ws-1", "thread-1", "waiting"])
        })
    })
}

describe("WorkThreadsService", () => {
    registerCreateFor()
    registerReads()
    registerStatus()
})

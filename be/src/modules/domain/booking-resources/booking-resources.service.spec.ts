import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BookingResourceWrite } from "./booking-resources.contracts"
import { BookingResourcesService } from "./booking-resources.service"
import {
    DELETE_RESOURCE,
    INSERT_RESOURCE,
    LOCK_RESOURCE,
    LOCK_STAFF,
    RETIRE_RESOURCE,
    SELECT_RESOURCE_USAGE,
    UPDATE_RESOURCE,
} from "./persistence/booking-resources.sql"

const writeOf = builder<BookingResourceWrite>({
    workspaceId: "ws-1",
    id: null,
    name: "Anna",
    kind: "staff",
    capacity: 1,
    active: true,
    staffId: "s-1",
})

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingResourcesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingResourcesService)
}

describe("BookingResourcesService", () => {
    describe("save", () => {
        it("inserts a new resource and answers its id", async () => {
            const em = mockEntityManager({ query: [INSERT_RESOURCE, [{ id: "r-1" }]] })
            const resources = await build(em)

            await expect(resources.save(writeOf())).resolves.toEqual([{ id: "r-1" }])
            expect(em.query.mock.calls).toEqual([[INSERT_RESOURCE, ["ws-1", "Anna", "staff", 1, true, "s-1"]]])
        })

        it("updates an existing resource by its id in the transaction of the caller", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({ query: [UPDATE_RESOURCE, [{ id: "r-2" }]] })
            const resources = await build(own)

            await expect(resources.save(writeOf({ id: "r-2", staffId: null }), caller)).resolves.toEqual([
                { id: "r-2" },
            ])
            expect(caller.query.mock.calls).toEqual([
                [UPDATE_RESOURCE, ["ws-1", "Anna", "staff", 1, true, null, "r-2"]],
            ])
            expect(own.query).not.toHaveBeenCalled()
        })
    })

    describe("lock and lockStaff", () => {
        it("answers the held resource and the held staff link", async () => {
            const em = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ id: "r-1" }]],
                    [LOCK_STAFF, []],
                ],
            })
            const resources = await build()

            await expect(resources.lock("ws-1", "r-1", em)).resolves.toEqual([{ id: "r-1" }])
            await expect(resources.lockStaff("ws-1", "s-9", em)).resolves.toEqual([])
        })
    })

    describe("used", () => {
        it("is true only when the history still references the resource", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_RESOURCE_USAGE, [{ value: true }]],
                    [SELECT_RESOURCE_USAGE, []],
                ],
            })
            const resources = await build()

            await expect(resources.used("ws-1", "r-1", em)).resolves.toBe(true)
            await expect(resources.used("ws-1", "r-2", em)).resolves.toBe(false)
        })
    })

    describe("remove", () => {
        it("retires a resource with history and deletes one without", async () => {
            const em = mockEntityManager({
                query: [
                    [RETIRE_RESOURCE, [{ id: "r-1" }]],
                    [DELETE_RESOURCE, [{ id: "r-2" }]],
                ],
            })
            const resources = await build()

            await expect(resources.remove("ws-1", "r-1", true, em)).resolves.toEqual([{ id: "r-1" }])
            await expect(resources.remove("ws-1", "r-2", false, em)).resolves.toEqual([{ id: "r-2" }])
            expect(em.query.mock.calls).toEqual([
                [RETIRE_RESOURCE, ["ws-1", "r-1"]],
                [DELETE_RESOURCE, ["ws-1", "r-2"]],
            ])
        })
    })
})

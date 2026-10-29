import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BookingResourceWrite } from "./booking-resources.contracts"
import { BookingResourcesService } from "./booking-resources.service"
import { BookingResourceEntity } from "./persistence/entities"

const writeOf = builder<BookingResourceWrite>({
    workspaceId: "ws-1",
    id: null,
    name: "Anna",
    kind: "staff",
    capacity: 1,
    active: true,
    staffId: "s-1",
})

const VALUES = { name: "Anna", kind: "staff", capacity: 1, active: true, staffId: "s-1" }

/** A manager whose query builders answer `answers`, one fake per `createQueryBuilder` call, in order. */
const withBuilders = (...answers: Array<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) em.createQueryBuilder.mockReturnValueOnce(fake.builder)
    return { em, fakes }
}

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingResourcesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingResourcesService)
}

describe("BookingResourcesService", () => {
    describe("save", () => {
        it("inserts a new resource and answers its id", async () => {
            const { em, fakes } = withBuilders({ execute: { raw: [{ id: "r-1" }] } })
            const resources = await build(em)

            await expect(resources.save(writeOf())).resolves.toEqual([{ id: "r-1" }])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(BookingResourceEntity, "br")
            expect(fakes[0]?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", ...VALUES }]])
            expect(fakes[0]?.callsOf("returning")).toEqual([["id"]])
        })

        it("updates an existing resource by its id in the transaction of the caller", async () => {
            const own = mockEntityManager()
            const { em: caller, fakes } = withBuilders({ execute: { raw: [{ id: "r-2" }] } })
            const resources = await build(own)

            await expect(resources.save(writeOf({ id: "r-2", staffId: null }), caller)).resolves.toEqual([
                { id: "r-2" },
            ])
            expect(fakes[0]?.callsOf("set")).toEqual([[{ ...VALUES, staffId: null }]])
            expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "r-2" }]])
            expect(own.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("answers nothing for a resource of another workspace", async () => {
            const { em } = withBuilders({ execute: { raw: [] } })
            const resources = await build()

            await expect(resources.save(writeOf({ id: "r-9" }), em)).resolves.toEqual([])
        })
    })
})

describe("BookingResourcesService", () => {
    describe("lock and lockStaff", () => {
        it("answers the held resource and the held staff link", async () => {
            const { em, fakes } = withBuilders({ getRawOne: undefined })
            em.findOne.mockResolvedValueOnce(Object.assign(new BookingResourceEntity(), { id: "r-1" }))
            const resources = await build()

            await expect(resources.lock("ws-1", "r-1", em)).resolves.toEqual([{ id: "r-1" }])
            await expect(resources.lockStaff("ws-1", "s-9", em)).resolves.toEqual([])
            expect(em.findOne).toHaveBeenCalledWith(BookingResourceEntity, {
                select: { id: true },
                where: { workspaceId: "ws-1", id: "r-1" },
                lock: { mode: "pessimistic_write" },
            })
            expect(fakes[0]?.callsOf("setLock")).toEqual([["pessimistic_read"]])
        })

        it("answers the held staff link", async () => {
            const { em } = withBuilders({ getRawOne: { id: "s-1" } })
            const resources = await build()

            await expect(resources.lockStaff("ws-1", "s-1", em)).resolves.toEqual([{ id: "s-1" }])
        })
    })
})

describe("BookingResourcesService", () => {
    describe("used", () => {
        it("is true when the bookings or the waitlist still reference it", async () => {
            const { em, fakes } = withBuilders({ getRawOne: { id: "x-1" } })
            const target = await build()

            await expect(target.used("ws-1", "x-1", em)).resolves.toBe(true)
            expect(fakes[0]?.callsOf("where")).toEqual([
                ["o.workspaceId = :workspaceId AND o.id = :id", { workspaceId: "ws-1", id: "x-1" }],
            ])
        })

        it("is false when nothing references it", async () => {
            const { em } = withBuilders({ getRawOne: undefined })
            const target = await build()

            await expect(target.used("ws-1", "x-2", em)).resolves.toBe(false)
        })
    })
})

describe("BookingResourcesService", () => {
    describe("remove", () => {
        it("retires a resource with history and deletes one without", async () => {
            const { em, fakes } = withBuilders(
                { execute: { raw: [{ id: "r-1" }] } },
                { execute: { raw: [{ id: "r-2" }] } },
            )
            const resources = await build()

            await expect(resources.remove("ws-1", "r-1", true, em)).resolves.toEqual([{ id: "r-1" }])
            await expect(resources.remove("ws-1", "r-2", false, em)).resolves.toEqual([{ id: "r-2" }])
            expect(fakes[0]?.callsOf("set")).toEqual([[{ active: false }]])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(BookingResourceEntity, "br")
        })
    })
})

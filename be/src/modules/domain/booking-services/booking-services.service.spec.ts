import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BookingServiceWrite } from "./booking-services.contracts"
import { BookingServicesService } from "./booking-services.service"
import { BookingServiceEntity } from "./persistence/entities"

const writeOf = builder<BookingServiceWrite>({
    workspaceId: "ws-1",
    id: null,
    name: "Haircut",
    description: "Wash and cut",
    durationMin: 45,
    bufferMin: 15,
    priceVnd: 150000,
    resourceKind: "staff",
    followupDays: 30,
    active: true,
})

const VALUES = {
    name: "Haircut",
    description: "Wash and cut",
    durationMin: 45,
    bufferMin: 15,
    priceVnd: "150000",
    resourceKind: "staff",
    followupDays: 30,
    active: true,
}

/** A manager whose query builders answer `answers`, one fake per `createQueryBuilder` call, in order. */
const withBuilders = (...answers: Array<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) em.createQueryBuilder.mockReturnValueOnce(fake.builder)
    return { em, fakes }
}

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingServicesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingServicesService)
}

describe("BookingServicesService", () => {
    describe("save", () => {
        it("inserts a new service and answers its id", async () => {
            const { em, fakes } = withBuilders({ execute: { raw: [{ id: "svc-1" }] } })
            const services = await build(em)

            await expect(services.save(writeOf())).resolves.toEqual([{ id: "svc-1" }])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(BookingServiceEntity, "bs")
            expect(fakes[0]?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", ...VALUES }]])
            expect(fakes[0]?.callsOf("returning")).toEqual([["id"]])
        })

        it("keeps an absent price absent", async () => {
            const { em, fakes } = withBuilders({ execute: { raw: [{ id: "svc-1" }] } })
            const services = await build(em)

            await services.save(writeOf({ priceVnd: null }))
            expect(fakes[0]?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", ...VALUES, priceVnd: null }]])
        })

        it("updates an existing service by its id in the transaction of the caller", async () => {
            const own = mockEntityManager()
            const { em: caller, fakes } = withBuilders({ execute: { raw: [{ id: "svc-2" }] } })
            const services = await build(own)

            await expect(services.save(writeOf({ id: "svc-2" }), caller)).resolves.toEqual([{ id: "svc-2" }])
            expect(caller.createQueryBuilder).toHaveBeenCalledWith(BookingServiceEntity, "bs")
            expect(fakes[0]?.callsOf("set")).toEqual([[VALUES]])
            expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "svc-2" }]])
            expect(own.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("answers nothing for a service of another workspace", async () => {
            const { em } = withBuilders({ execute: { raw: [] } })
            const services = await build()

            await expect(services.save(writeOf({ id: "svc-9" }), em)).resolves.toEqual([])
        })

        it("answers nothing when the statement hands back no rows at all", async () => {
            const { em } = withBuilders({ execute: {} })
            const services = await build()

            await expect(services.save(writeOf({ id: "svc-9" }), em)).resolves.toEqual([])
        })
    })
})

describe("BookingServicesService", () => {
    describe("lock", () => {
        it("answers the held service", async () => {
            const em = mockEntityManager({
                findOne: [BookingServiceEntity, Object.assign(new BookingServiceEntity(), { id: "svc-1" })],
            })
            const services = await build()

            await expect(services.lock("ws-1", "svc-1", em)).resolves.toEqual([{ id: "svc-1" }])
            expect(em.findOne).toHaveBeenCalledWith(BookingServiceEntity, {
                select: { id: true },
                where: { workspaceId: "ws-1", id: "svc-1" },
                lock: { mode: "pessimistic_write" },
            })
        })

        it("answers nothing for a service that is not owned", async () => {
            const em = mockEntityManager({ findOne: [BookingServiceEntity, null] })
            const services = await build()

            await expect(services.lock("ws-1", "svc-9", em)).resolves.toEqual([])
        })
    })
})

describe("BookingServicesService", () => {
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

describe("BookingServicesService", () => {
    describe("remove", () => {
        it("retires a service with history and deletes one without", async () => {
            const { em, fakes } = withBuilders(
                { execute: { raw: [{ id: "svc-1" }] } },
                { execute: { raw: [{ id: "svc-2" }] } },
            )
            const services = await build()

            await expect(services.remove("ws-1", "svc-1", true, em)).resolves.toEqual([{ id: "svc-1" }])
            await expect(services.remove("ws-1", "svc-2", false, em)).resolves.toEqual([{ id: "svc-2" }])
            expect(fakes[0]?.callsOf("set")).toEqual([[{ active: false }]])
            expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "svc-1" }]])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(BookingServiceEntity, "bs")
            expect(fakes[1]?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "svc-2" }]])
        })
    })
})

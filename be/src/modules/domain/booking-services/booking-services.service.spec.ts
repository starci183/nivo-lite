import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BookingServiceWrite } from "./booking-services.contracts"
import { BookingServicesService } from "./booking-services.service"
import {
    DELETE_SERVICE,
    INSERT_SERVICE,
    LOCK_SERVICE,
    RETIRE_SERVICE,
    SELECT_SERVICE_USAGE,
    UPDATE_SERVICE,
} from "./persistence/booking-services.sql"

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

const VALUES = ["ws-1", "Haircut", "Wash and cut", 45, 15, 150000, "staff", 30, true]

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingServicesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingServicesService)
}

describe("BookingServicesService", () => {
    describe("save", () => {
        it("inserts a new service and answers its id", async () => {
            const em = mockEntityManager({ query: [INSERT_SERVICE, [{ id: "svc-1" }]] })
            const services = await build(em)

            await expect(services.save(writeOf())).resolves.toEqual([{ id: "svc-1" }])
            expect(em.query.mock.calls).toEqual([[INSERT_SERVICE, VALUES]])
        })

        it("updates an existing service by its id in the transaction of the caller", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({ query: [UPDATE_SERVICE, [{ id: "svc-2" }]] })
            const services = await build(own)

            await expect(services.save(writeOf({ id: "svc-2" }), caller)).resolves.toEqual([{ id: "svc-2" }])
            expect(caller.query.mock.calls).toEqual([[UPDATE_SERVICE, [...VALUES, "svc-2"]]])
            expect(own.query).not.toHaveBeenCalled()
        })
    })

    describe("lock", () => {
        it("answers the held service", async () => {
            const em = mockEntityManager({ query: [LOCK_SERVICE, [{ id: "svc-1" }]] })
            const services = await build()

            await expect(services.lock("ws-1", "svc-1", em)).resolves.toEqual([{ id: "svc-1" }])
        })
    })

    describe("used", () => {
        it("is true only when bookings or the waitlist still reference the service", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_SERVICE_USAGE, [{ value: true }]],
                    [SELECT_SERVICE_USAGE, [{ value: false }]],
                ],
            })
            const services = await build()

            await expect(services.used("ws-1", "svc-1", em)).resolves.toBe(true)
            await expect(services.used("ws-1", "svc-2", em)).resolves.toBe(false)
        })
    })

    describe("remove", () => {
        it("retires a service with history and deletes one without", async () => {
            const em = mockEntityManager({
                query: [
                    [RETIRE_SERVICE, [{ id: "svc-1" }]],
                    [DELETE_SERVICE, [{ id: "svc-2" }]],
                ],
            })
            const services = await build()

            await expect(services.remove("ws-1", "svc-1", true, em)).resolves.toEqual([{ id: "svc-1" }])
            await expect(services.remove("ws-1", "svc-2", false, em)).resolves.toEqual([{ id: "svc-2" }])
            expect(em.query.mock.calls).toEqual([
                [RETIRE_SERVICE, ["ws-1", "svc-1"]],
                [DELETE_SERVICE, ["ws-1", "svc-2"]],
            ])
        })
    })
})

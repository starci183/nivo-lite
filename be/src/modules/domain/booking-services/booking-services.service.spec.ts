import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingServicesService } from "./booking-services.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [BookingServicesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(BookingServicesService), entityManager }
}

describe("BookingServicesService", () => {
    describe("save", () => {
        it("save has its first case written", async () => {
            const { service } = await build()
            expect(service.save).toBeInstanceOf(Function)
        })
    })

    describe("lock", () => {
        it("lock has its first case written", async () => {
            const { service } = await build()
            expect(service.lock).toBeInstanceOf(Function)
        })
    })

    describe("used", () => {
        it("used has its first case written", async () => {
            const { service } = await build()
            expect(service.used).toBeInstanceOf(Function)
        })
    })

    describe("remove", () => {
        it("remove has its first case written", async () => {
            const { service } = await build()
            expect(service.remove).toBeInstanceOf(Function)
        })
    })
})

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    CATALOGUE_FIND,
    CUT_SERVICE,
    DYE_SERVICE,
    TIMED_SERVICE,
    TIMING_FIND,
    namesFindOf,
} from "@tests/fixtures/builders/booking-services.builder"
import { BookingServicesReadService } from "./booking-services-read.service"
import { BookingServiceEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingServicesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingServicesReadService)
}

describe("BookingServicesReadService", () => {
    it("lists the services of a workspace in the owner's order, at most 200", async () => {
        const rows = [CUT_SERVICE]
        const em = mockEntityManager({ find: [BookingServiceEntity, rows] })
        const services = await build(em)

        await expect(services.catalogue("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([[BookingServiceEntity, CATALOGUE_FIND]])
    })

    it("names the given services by id", async () => {
        const em = mockEntityManager({ find: [BookingServiceEntity, [CUT_SERVICE, DYE_SERVICE]] })
        const services = await build(em)

        await expect(services.namesOf("ws-1", ["s-1", "s-2"])).resolves.toEqual(
            new Map([
                ["s-1", "Cut"],
                ["s-2", "Dye"],
            ]),
        )

        expect(em.find.mock.calls).toEqual([[BookingServiceEntity, namesFindOf(["s-1", "s-2"])]])
    })

    it("reads nothing when no names are wanted", async () => {
        const em = mockEntityManager()
        const services = await build(em)

        await expect(services.namesOf("ws-1", [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
    })

    it("answers how long a service holds a resource", async () => {
        const timing = TIMED_SERVICE
        const em = mockEntityManager({ findOne: [BookingServiceEntity, timing] })
        const services = await build(em)

        await expect(services.timingOf("ws-1", "s-1")).resolves.toEqual(timing)

        expect(em.findOne.mock.calls).toEqual([[BookingServiceEntity, TIMING_FIND]])
    })
})

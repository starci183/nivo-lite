import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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
        const rows = [{ id: "s-1", name: "Cut" }]
        const em = mockEntityManager({ find: [BookingServiceEntity, rows] })
        const services = await build(em)

        await expect(services.catalogue("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([
            [
                BookingServiceEntity,
                { where: { workspaceId: "ws-1" }, order: { sortOrder: "ASC", createdAt: "ASC" }, take: 200 },
            ],
        ])
    })

    it("names the given services by id", async () => {
        const em = mockEntityManager({
            find: [
                BookingServiceEntity,
                [
                    { id: "s-1", name: "Cut" },
                    { id: "s-2", name: "Dye" },
                ],
            ],
        })
        const services = await build(em)

        await expect(services.namesOf("ws-1", ["s-1", "s-2"])).resolves.toEqual(
            new Map([
                ["s-1", "Cut"],
                ["s-2", "Dye"],
            ]),
        )

        expect(em.find.mock.calls).toEqual([
            [
                BookingServiceEntity,
                { select: { id: true, name: true }, where: { workspaceId: "ws-1", id: In(["s-1", "s-2"]) }, take: 2 },
            ],
        ])
    })

    it("reads nothing when no names are wanted", async () => {
        const em = mockEntityManager()
        const services = await build(em)

        await expect(services.namesOf("ws-1", [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
    })

    it("answers how long a service holds a resource", async () => {
        const em = mockEntityManager({ findOne: [BookingServiceEntity, { durationMin: 30, bufferMin: 5 }] })
        const services = await build(em)

        await expect(services.timingOf("ws-1", "s-1")).resolves.toEqual({ durationMin: 30, bufferMin: 5 })

        expect(em.findOne.mock.calls).toEqual([
            [
                BookingServiceEntity,
                { select: { durationMin: true, bufferMin: true }, where: { workspaceId: "ws-1", id: "s-1" } },
            ],
        ])
    })
})

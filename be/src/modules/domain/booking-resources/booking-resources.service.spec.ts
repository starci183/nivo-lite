import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingResourcesService } from "./booking-resources.service"
import type { BookingResourceWrite } from "./booking-resources.contracts"
import { INSERT_RESOURCE, LOCK_RESOURCE } from "./persistence/booking-resources.sql"

const WRITE: BookingResourceWrite = {
    workspaceId: "ws-1",
    id: null,
    name: "Anna",
    kind: "staff",
    capacity: 1,
    active: true,
    staffId: null,
}

const build = async () => {
    const entityManager = mockEntityManager({
        query: [
            [INSERT_RESOURCE, [{ id: "r1" }]],
            [LOCK_RESOURCE, [{ id: "r1" }]],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [BookingResourcesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { resources: moduleRef.get(BookingResourcesService), entityManager }
}

describe("BookingResourcesService", () => {
    it("inserts a new resource and returns the saved id", async () => {
        const { resources, entityManager } = await build()

        await expect(resources.save(WRITE)).resolves.toEqual([{ id: "r1" }])

        expect(entityManager.query).toHaveBeenCalledWith(INSERT_RESOURCE, ["ws-1", "Anna", "staff", 1, true, null])
    })

    it("holds an owned resource until the caller's transaction finishes", async () => {
        const { resources, entityManager } = await build()

        await expect(resources.lock("ws-1", "r1", entityManager)).resolves.toEqual([{ id: "r1" }])

        expect(entityManager.query).toHaveBeenCalledWith(LOCK_RESOURCE, ["ws-1", "r1"])
    })
})

import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingResourcesReadService } from "./booking-resources-read.service"
import { BookingResourceEntity } from "./persistence/entities"

const rowOf = builder<BookingResourceEntity>({
    id: "r-0",
    workspaceId: "ws-1",
    name: "Room",
    kind: "room",
    capacity: 1,
    color: "#000000",
    active: true,
    staffId: null,
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})
const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingResourcesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingResourcesReadService)
}

describe("BookingResourcesReadService", () => {
    it("lists the resources of a workspace in the owner's order, at most 200", async () => {
        const rows = [rowOf({ id: "r-1", name: "Chair" })]
        const em = mockEntityManager({ find: [BookingResourceEntity, rows] })
        const resources = await build(em)

        await expect(resources.catalogue("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([
            [
                BookingResourceEntity,
                { where: { workspaceId: "ws-1" }, order: { sortOrder: "ASC", createdAt: "ASC" }, take: 200 },
            ],
        ])
    })

    it("lists the resources linked to a staff member", async () => {
        const rows = [rowOf({ id: "r-1", staffId: "st-1" })]
        const em = mockEntityManager({ find: [BookingResourceEntity, rows] })
        const resources = await build(em)

        await expect(resources.staffLinked("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([
            [
                BookingResourceEntity,
                {
                    select: { id: true, staffId: true },
                    where: { workspaceId: "ws-1", staffId: Not(IsNull()) },
                    take: 200,
                },
            ],
        ])
    })

    it("names the given resources by id", async () => {
        const em = mockEntityManager({ find: [BookingResourceEntity, [rowOf({ id: "r-1", name: "Chair" })]] })
        const resources = await build(em)

        await expect(resources.namesOf("ws-1", ["r-1"])).resolves.toEqual(new Map([["r-1", "Chair"]]))

        expect(em.find.mock.calls).toEqual([
            [
                BookingResourceEntity,
                { select: { id: true, name: true }, where: { workspaceId: "ws-1", id: In(["r-1"]) }, take: 1 },
            ],
        ])
    })

    it("reads nothing when no names are wanted", async () => {
        const em = mockEntityManager()
        const resources = await build(em)

        await expect(resources.namesOf("ws-1", [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
    })

    it("locks a resource in the caller's transaction and answers its capacity", async () => {
        const own = mockEntityManager()
        const locked = rowOf({ capacity: 3 })
        const caller = mockEntityManager({ findOne: [BookingResourceEntity, locked] })
        const resources = await build(own)

        await expect(resources.lockCapacity(caller, "ws-1", "r-1")).resolves.toEqual(locked)

        expect(caller.findOne.mock.calls).toEqual([
            [
                BookingResourceEntity,
                {
                    select: { capacity: true },
                    where: { id: "r-1", workspaceId: "ws-1" },
                    lock: { mode: "pessimistic_write" },
                },
            ],
        ])
        expect(own.findOne).not.toHaveBeenCalled()
    })
})

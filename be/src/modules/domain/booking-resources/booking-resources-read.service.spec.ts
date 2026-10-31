import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Not } from "typeorm"
import {
    capacityResourceRow,
    namedResourceRow,
    staffResourceRow,
} from "@tests/fixtures/builders/booking-resources-rows.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingResourcesReadService } from "./booking-resources-read.service"
import { BookingResourceEntity } from "./persistence/entities"

/** The `find`/`findOne` call the service is expected to make on the resource table. */
const callOn = (options: object) => [[BookingResourceEntity, options]]
const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingResourcesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingResourcesReadService)
}

describe("BookingResourcesReadService", () => {
    it("lists the resources of a workspace in the owner's order, at most 200", async () => {
        const rows = [namedResourceRow("r-1", "Chair")]
        const em = mockEntityManager({ find: [BookingResourceEntity, rows] })
        const resources = await build(em)

        await expect(resources.catalogue("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual(
            callOn({ where: { workspaceId: "ws-1" }, order: { sortOrder: "ASC", createdAt: "ASC" }, take: 200 }),
        )
    })

    it("lists the resources linked to a staff member", async () => {
        const rows = [staffResourceRow("r-1", "st-1")]
        const em = mockEntityManager({ find: [BookingResourceEntity, rows] })
        const resources = await build(em)

        await expect(resources.staffLinked("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual(
            callOn({
                select: { id: true, staffId: true },
                where: { workspaceId: "ws-1", staffId: Not(IsNull()) },
                take: 200,
            }),
        )
    })

    it("names the given resources by id", async () => {
        const em = mockEntityManager({ find: [BookingResourceEntity, [namedResourceRow("r-1", "Chair")]] })
        const resources = await build(em)

        await expect(resources.namesOf("ws-1", ["r-1"])).resolves.toEqual(new Map([["r-1", "Chair"]]))

        expect(em.find.mock.calls).toEqual(
            callOn({ select: ["id", "name"], where: { workspaceId: "ws-1", id: In(["r-1"]) }, take: 1 }),
        )
    })

    it("reads nothing when no names are wanted", async () => {
        const em = mockEntityManager()
        const resources = await build(em)

        await expect(resources.namesOf("ws-1", [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
    })

    it("locks a resource in the caller's transaction and answers its capacity", async () => {
        const own = mockEntityManager()
        const locked = capacityResourceRow(3)
        const caller = mockEntityManager({ findOne: [BookingResourceEntity, locked] })
        const resources = await build(own)

        await expect(resources.lockCapacity(caller, "ws-1", "r-1")).resolves.toEqual(locked)

        expect(caller.findOne.mock.calls).toEqual(
            callOn({
                select: { capacity: true },
                where: { id: "r-1", workspaceId: "ws-1" },
                lock: { mode: "pessimistic_write" },
            }),
        )
        expect(own.findOne).not.toHaveBeenCalled()
    })
})

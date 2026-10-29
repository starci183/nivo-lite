import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { MoreThanOrEqual } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { bookingExceptionRowOf } from "@tests/fixtures/builders/booking-exceptions.builder"
import { BookingExceptionsReadService } from "./booking-exceptions-read.service"
import { BookingExceptionEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingExceptionsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingExceptionsReadService)
}

describe("BookingExceptionsReadService", () => {
    it("lists every exception of a workspace in date order", async () => {
        const rows = [bookingExceptionRowOf({ id: "e-1", onDate: "2026-10-20" })]
        const em = mockEntityManager({ find: [BookingExceptionEntity, rows] })
        const exceptions = await build(em)

        await expect(exceptions.list("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([
            [
                BookingExceptionEntity,
                { where: { workspaceId: "ws-1" }, order: { onDate: "ASC", id: "ASC" }, take: 1000 },
            ],
        ])
    })

    it("lists the exceptions from a local date on", async () => {
        const em = mockEntityManager({ find: [BookingExceptionEntity, []] })
        const exceptions = await build(em)

        await expect(exceptions.list("ws-1", "2026-10-19")).resolves.toEqual([])

        expect(em.find.mock.calls).toEqual([
            [
                BookingExceptionEntity,
                {
                    where: { workspaceId: "ws-1", onDate: MoreThanOrEqual("2026-10-19") },
                    order: { onDate: "ASC", id: "ASC" },
                    take: 1000,
                },
            ],
        ])
    })
})

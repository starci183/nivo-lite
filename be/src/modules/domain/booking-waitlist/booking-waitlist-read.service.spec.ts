import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { waitingWaitlistRow } from "@tests/fixtures/builders/booking-waitlist-rows.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistReadService } from "./booking-waitlist-read.service"
import { BookingWaitlistEntity } from "./persistence/entities"

/** The `find` call the service is expected to make on the waitlist table. */
const callOn = (options: object) => [[BookingWaitlistEntity, options]]
const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistReadService)
}

describe("BookingWaitlistReadService", () => {
    it("lists the customers still waiting or notified, newest first, at most 100", async () => {
        const rows = [waitingWaitlistRow("w-1")]
        const em = mockEntityManager({ find: [BookingWaitlistEntity, rows] })
        const waitlist = await build(em)

        await expect(waitlist.open("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual(
            callOn({
                where: { workspaceId: "ws-1", status: In(["waiting", "notified"]) },
                order: { createdAt: "DESC", id: "ASC" },
                take: 100,
            }),
        )
    })
})

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistReadService } from "./booking-waitlist-read.service"
import { BookingWaitlistEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistReadService)
}

describe("BookingWaitlistReadService", () => {
    it("lists the customers still waiting or notified, newest first, at most 100", async () => {
        const rows = [{ id: "w-1", status: "waiting" }]
        const em = mockEntityManager({ find: [BookingWaitlistEntity, rows] })
        const waitlist = await build(em)

        await expect(waitlist.open("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([
            [
                BookingWaitlistEntity,
                {
                    where: { workspaceId: "ws-1", status: In(["waiting", "notified"]) },
                    order: { createdAt: "DESC", id: "ASC" },
                    take: 100,
                },
            ],
        ])
    })
})

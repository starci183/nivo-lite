import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistReadService } from "./booking-waitlist-read.service"
import { BookingWaitlistEntity } from "./persistence/entities"

const rowOf = builder<BookingWaitlistEntity>({
    id: "w-0",
    workspaceId: "ws-1",
    leadId: null,
    conversationId: null,
    customerName: "Lan",
    customerPhone: null,
    serviceId: "s-1",
    resourceId: null,
    windowStart: new Date("2026-10-20T09:00:00.000Z"),
    windowEnd: new Date("2026-10-20T12:00:00.000Z"),
    partySize: 1,
    status: "waiting",
    notifiedAt: null,
    note: "",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})
const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistReadService)
}

describe("BookingWaitlistReadService", () => {
    it("lists the customers still waiting or notified, newest first, at most 100", async () => {
        const rows = [rowOf({ id: "w-1", status: "waiting" })]
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

import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingSettingsReadService } from "./booking-settings-read.service"
import { BookingSettingEntity } from "./persistence/entities"

const rowOf = builder<BookingSettingEntity>({
    workspaceId: "ws-0",
    timezone: "UTC",
    slotStepMin: 15,
    minLeadMin: 0,
    maxAdvanceDays: 30,
    cancelWindowHours: 0,
    depositPct: 0,
    lateCancelFeePct: 0,
    noShowFeeVnd: "0",
    autoConfirm: false,
    handoffOrder: false,
    reminderHours: [],
    publicEnabled: false,
    publicSlug: null,
    publicNote: "",
    address: "",
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})
const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingSettingsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingSettingsReadService)
}

describe("BookingSettingsReadService", () => {
    it("answers the settings a workspace saved", async () => {
        const saved = rowOf({ workspaceId: "ws-1", timezone: "Asia/Ho_Chi_Minh" })
        const em = mockEntityManager({ findOneBy: [BookingSettingEntity, saved] })
        const settings = await build(em)

        await expect(settings.of("ws-1")).resolves.toEqual(saved)

        expect(em.findOneBy.mock.calls).toEqual([[BookingSettingEntity, { workspaceId: "ws-1" }]])
    })

    it("answers the page that is on under a slug", async () => {
        const page = rowOf({ workspaceId: "ws-1", publicNote: "Hi", address: "1 Road", timezone: "Asia/Ho_Chi_Minh" })
        const em = mockEntityManager({ findOne: [BookingSettingEntity, page] })
        const settings = await build(em)

        await expect(settings.publishedBy("salon")).resolves.toEqual(page)

        expect(em.findOne.mock.calls).toEqual([
            [
                BookingSettingEntity,
                {
                    select: { workspaceId: true, publicNote: true, address: true, timezone: true },
                    where: { publicSlug: "salon", publicEnabled: true },
                },
            ],
        ])
    })
})

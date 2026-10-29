import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingSettingsReadService } from "./booking-settings-read.service"
import { BookingSettingEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingSettingsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingSettingsReadService)
}

describe("BookingSettingsReadService", () => {
    it("answers the settings a workspace saved", async () => {
        const saved = { workspaceId: "ws-1", timezone: "Asia/Ho_Chi_Minh" }
        const em = mockEntityManager({ findOneBy: [BookingSettingEntity, saved] })
        const settings = await build(em)

        await expect(settings.of("ws-1")).resolves.toEqual(saved)

        expect(em.findOneBy.mock.calls).toEqual([[BookingSettingEntity, { workspaceId: "ws-1" }]])
    })

    it("answers the page that is on under a slug", async () => {
        const page = { workspaceId: "ws-1", publicNote: "Hi", address: "1 Road", timezone: "Asia/Ho_Chi_Minh" }
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

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PUBLIC_PAGE_UPSERT_ROW } from "@tests/fixtures/builders/booking-settings.builder"
import { BookingSettingsService } from "./booking-settings.service"
import { Not } from "typeorm"
import { BookingSettingEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingSettingsService)
}

describe("BookingSettingsService", () => {
    describe("savePolicy", () => {
        it("writes every policy value and answers the settings id", async () => {
            const em = mockEntityManager({ upsert: [BookingSettingEntity, {}] })
            const settings = await build(em)

            const saved = await settings.savePolicy({
                workspaceId: "ws-1",
                cancelWindowHours: 24,
                depositPct: 30,
                lateCancelFeePct: 50,
                noShowFeeVnd: 100000,
                minLeadMin: 60,
                maxAdvanceDays: 30,
                slotStepMin: 15,
                autoConfirm: true,
                handoffOrder: false,
                address: "1 Le Loi",
                timezone: "Asia/Ho_Chi_Minh",
            })

            expect(saved).toEqual([{ id: "ws-1" }])
            expect(em.upsert.mock.calls).toEqual([
                [
                    BookingSettingEntity,
                    {
                        workspaceId: "ws-1",
                        cancelWindowHours: 24,
                        depositPct: 30,
                        lateCancelFeePct: 50,
                        noShowFeeVnd: "100000",
                        minLeadMin: 60,
                        maxAdvanceDays: 30,
                        slotStepMin: 15,
                        autoConfirm: true,
                        handoffOrder: false,
                        address: "1 Le Loi",
                        timezone: "Asia/Ho_Chi_Minh",
                    },
                    ["workspaceId"],
                ],
            ])
        })
    })
})

describe("BookingSettingsService", () => {
    describe("slugOwner", () => {
        it("answers the other workspace that owns the slug, through the manager of the caller", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({
                findOne: [BookingSettingEntity, Object.assign(new BookingSettingEntity(), { workspaceId: "ws-2" })],
            })
            const settings = await build(own)

            await expect(settings.slugOwner("ws-1", "tiem-hoa", caller)).resolves.toEqual([{ id: "ws-2" }])
            expect(caller.findOne).toHaveBeenCalledWith(BookingSettingEntity, {
                select: { workspaceId: true },
                where: { workspaceId: Not("ws-1"), publicSlug: "tiem-hoa" },
            })
            expect(own.findOne).not.toHaveBeenCalled()
        })

        it("answers nothing when the workspace has no slug to compare, or no other workspace owns it", async () => {
            const em = mockEntityManager({ findOne: [BookingSettingEntity, null] })
            const settings = await build(em)

            await expect(settings.slugOwner("ws-1", null)).resolves.toEqual([])
            await expect(settings.slugOwner("ws-1", "tiem-hoa")).resolves.toEqual([])
            expect(em.findOne).toHaveBeenCalledTimes(1)
        })
    })
})

describe("BookingSettingsService", () => {
    describe("savePublicPage", () => {
        it("writes the publishing values and answers the settings id", async () => {
            const em = mockEntityManager({ upsert: [BookingSettingEntity, {}] })
            const settings = await build(em)

            await expect(
                settings.savePublicPage({
                    workspaceId: "ws-1",
                    enabled: true,
                    slug: null,
                    note: "Book online",
                }),
            ).resolves.toEqual([{ id: "ws-1" }])
            expect(em.upsert.mock.calls).toEqual([[BookingSettingEntity, PUBLIC_PAGE_UPSERT_ROW, ["workspaceId"]]])
        })
    })
})

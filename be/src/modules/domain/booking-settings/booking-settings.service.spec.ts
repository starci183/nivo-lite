import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingSettingsService } from "./booking-settings.service"
import {
    SELECT_SETUP_SLUG_OWNER,
    UPSERT_SETUP_POLICY,
    UPSERT_SETUP_PUBLIC_PAGE,
} from "./persistence/booking-settings.sql"

const UPDATED_AT = "2026-10-12T10:00:00.000Z"

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingSettingsService)
}

describe("BookingSettingsService", () => {
    describe("savePolicy", () => {
        it("writes every policy value in order and answers the settings id", async () => {
            const em = mockEntityManager({ query: [UPSERT_SETUP_POLICY, [{ id: "set-1" }]] })
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
                updatedAt: UPDATED_AT,
            })

            expect(saved).toEqual([{ id: "set-1" }])
            expect(em.query.mock.calls).toEqual([
                [
                    UPSERT_SETUP_POLICY,
                    ["ws-1", 24, 30, 50, 100000, 60, 30, 15, true, false, "1 Le Loi", "Asia/Ho_Chi_Minh", UPDATED_AT],
                ],
            ])
        })
    })

    describe("slugOwner", () => {
        it("answers the other workspace that owns the slug, through the manager of the caller", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({ query: [SELECT_SETUP_SLUG_OWNER, [{ id: "ws-2" }]] })
            const settings = await build(own)

            await expect(settings.slugOwner("ws-1", "tiem-hoa", caller)).resolves.toEqual([{ id: "ws-2" }])
            expect(caller.query).toHaveBeenCalledWith(SELECT_SETUP_SLUG_OWNER, ["ws-1", "tiem-hoa"])
            expect(own.query).not.toHaveBeenCalled()
        })
    })

    describe("savePublicPage", () => {
        it("writes the publishing values and answers the settings id", async () => {
            const em = mockEntityManager({ query: [UPSERT_SETUP_PUBLIC_PAGE, [{ id: "set-1" }]] })
            const settings = await build(em)

            await expect(
                settings.savePublicPage({
                    workspaceId: "ws-1",
                    enabled: true,
                    slug: null,
                    note: "Book online",
                    updatedAt: UPDATED_AT,
                }),
            ).resolves.toEqual([{ id: "set-1" }])
            expect(em.query.mock.calls).toEqual([
                [UPSERT_SETUP_PUBLIC_PAGE, ["ws-1", true, null, "Book online", UPDATED_AT]],
            ])
        })
    })
})

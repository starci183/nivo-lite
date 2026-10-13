import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingSettingsService } from "./booking-settings.service"
import type { SaveBookingSettingsPolicyParams } from "./booking-settings.contracts"
import { UPSERT_SETUP_POLICY } from "./persistence/booking-settings.sql"

const POLICY: SaveBookingSettingsPolicyParams = {
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
    address: "12 Le Loi",
    timezone: "Asia/Ho_Chi_Minh",
    updatedAt: "2026-10-13T03:00:00.000Z",
}

const build = async (rows: ReadonlyArray<{ id: string }>) => {
    const entityManager = mockEntityManager({ query: [UPSERT_SETUP_POLICY, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [BookingSettingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(BookingSettingsService), entityManager }
}

describe("BookingSettingsService", () => {
    it("saves the booking policy and answers the workspace id the upsert returned", async () => {
        const { service, entityManager } = await build([{ id: "ws-1" }])

        await expect(service.savePolicy(POLICY)).resolves.toEqual([{ id: "ws-1" }])
        expect(entityManager.query).toHaveBeenCalledWith(UPSERT_SETUP_POLICY, [
            "ws-1",
            24,
            30,
            50,
            100000,
            60,
            30,
            15,
            true,
            false,
            "12 Le Loi",
            "Asia/Ho_Chi_Minh",
            "2026-10-13T03:00:00.000Z",
        ])
    })
})

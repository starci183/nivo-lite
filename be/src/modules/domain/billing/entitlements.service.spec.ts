import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { Plan, WorkspaceBilling } from "./billing.contracts"
import { BillingService } from "./billing.service"
import { EntitlementsService } from "./entitlements.service"
import { BillingErrorCode } from "./errors/billing.error"
import {
    SELECT_ACTIVE_MEMBER_COUNT,
    SELECT_PENDING_INVITE_COUNT,
    SELECT_STORAGE_BYTES,
} from "./persistence/billing.sql"

const NOW = "2026-10-13T10:00:00.000Z"
const WORKSPACE = "ws-1"
const planOf = builder<Plan>({
    code: "team",
    nameVi: "Nhom",
    nameEn: "Team",
    priceVnd: 1000,
    period: "month",
    seats: 5,
    features: { vi: [], en: [] },
    sort: 1,
    aiCreditsPerMonth: 3000,
    isCustom: false,
    priceAnnualVnd: null,
    annualDiscountPct: null,
    promoPriceVnd: null,
    promoMonths: null,
    storageGb: 2,
    individual: false,
    perSeat: true,
    listed: true,
    tiers: [],
    packs: [],
})
const workspaceOf = builder<WorkspaceBilling>({
    status: "active",
    planCode: "team",
    paidUntil: null,
    tierCredits: null,
    seatCount: 1,
    billingCycle: "monthly",
    billedMonthlyVnd: 1000,
})

const build = async (entityManager: MockEntityManager) => {
    const billing = mock<BillingService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntitlementsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: BillingService, useValue: billing },
        ],
    }).compile()
    return { entitlements: moduleRef.get(EntitlementsService), billing }
}

describe("EntitlementsService", () => {
    it("reports the stored bytes and the room the plan includes", async () => {
        const em = mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: 2048 }]] })
        const { entitlements, billing } = await build(em)
        billing.findWorkspaceBilling.mockResolvedValue(workspaceOf())
        billing.findPlan.mockResolvedValue(planOf())

        await expect(entitlements.storageOf("user-1", WORKSPACE)).resolves.toEqual({
            usedBytes: 2048,
            quotaBytes: 2 * 1024 ** 3,
        })
        expect(billing.requireMember).toHaveBeenCalledWith("user-1", WORKSPACE)
    })

    it("lets an invitation through when the workspace has no plan", async () => {
        const { entitlements, billing } = await build(mockEntityManager())
        billing.findWorkspaceBilling.mockResolvedValue(null)

        await expect(entitlements.requireRoomForInvite(WORKSPACE)).resolves.toBeUndefined()
    })

    it("refuses an invitation when the paid seats are already taken", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_MEMBER_COUNT, [{ count: 1 }]],
                [SELECT_PENDING_INVITE_COUNT, [{ count: 0 }]],
            ],
        })
        const { entitlements, billing } = await build(em)
        billing.findWorkspaceBilling.mockResolvedValue(workspaceOf())
        billing.findPlan.mockResolvedValue(planOf())

        await expect(entitlements.requireRoomForInvite(WORKSPACE)).rejects.toMatchObject({
            code: BillingErrorCode.SeatLimitReached,
        })
        expect(em.query).toHaveBeenCalledWith(SELECT_PENDING_INVITE_COUNT, [WORKSPACE, new Date(NOW)])
    })
})

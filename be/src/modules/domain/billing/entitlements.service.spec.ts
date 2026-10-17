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

const NOW = new Date("2026-10-12T10:00:00.000Z")
const GB = 1024 ** 3

const planOf = builder<Plan>({
    code: "team",
    nameVi: "Nhom",
    nameEn: "Team",
    priceVnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: [], en: [] },
    sort: 1,
    aiCreditsPerMonth: 3000,
    isCustom: false,
    priceAnnualVnd: null,
    annualDiscountPct: null,
    promoPriceVnd: null,
    promoMonths: null,
    storageGb: 5,
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
    seatCount: 3,
    billingCycle: "monthly",
    billedMonthlyVnd: null,
})

const build = async (entityManager: MockEntityManager, plan: Plan | null = planOf(), workspace = workspaceOf()) => {
    const billing = mock<BillingService>({
        findWorkspaceBilling: jest.fn(() => Promise.resolve(workspace)),
        findPlan: jest.fn(() => Promise.resolve(plan)),
        requireMember: jest.fn(() => Promise.resolve()),
    })
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

describe("EntitlementsService > requireRoomForInvite", () => {
    it("lets an invitation in while members and pending invitations stay under the paid seats", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_MEMBER_COUNT, [{ count: 1 }]],
                [SELECT_PENDING_INVITE_COUNT, [{ count: 1 }]],
            ],
        })
        const { entitlements } = await build(em)

        await expect(entitlements.requireRoomForInvite("ws-1")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(SELECT_PENDING_INVITE_COUNT, ["ws-1", NOW])
    })

    it("refuses an invitation once the paid seats are taken", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_MEMBER_COUNT, [{ count: 2 }]],
                [SELECT_PENDING_INVITE_COUNT, [{ count: 1 }]],
            ],
        })
        const { entitlements } = await build(em)

        await expect(entitlements.requireRoomForInvite("ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.SeatLimitReached,
        })
    })

    it("refuses any invitation on an individual plan", async () => {
        const { entitlements } = await build(mockEntityManager(), planOf({ individual: true }))

        await expect(entitlements.requireRoomForInvite("ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.PlanIndividualOnly,
        })
    })

    it("does not limit a workspace without a plan or a plan that is not per seat", async () => {
        const unpaid = await build(mockEntityManager(), null, workspaceOf({ planCode: null }))
        const flat = await build(mockEntityManager(), planOf({ perSeat: false }))

        await expect(unpaid.entitlements.requireRoomForInvite("ws-1")).resolves.toBeUndefined()
        await expect(flat.entitlements.requireRoomForInvite("ws-1")).resolves.toBeUndefined()
    })
})

describe("EntitlementsService > requireRoomForMember", () => {
    it("does not impose membership limits when the workspace has no billing row", async () => {
        const em = mockEntityManager()
        const { entitlements, billing } = await build(em)
        billing.findWorkspaceBilling.mockResolvedValue(null)

        await expect(entitlements.requireRoomForMember("ws-1")).resolves.toBeUndefined()

        expect(billing.findWorkspaceBilling).toHaveBeenCalledWith("ws-1")
        expect(billing.findPlan).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses membership on an individual plan before counting members", async () => {
        const em = mockEntityManager()
        const { entitlements } = await build(em, planOf({ individual: true }))

        await expect(entitlements.requireRoomForMember("ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.PlanIndividualOnly,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("does not limit members on a plan without tracked seats", async () => {
        const em = mockEntityManager()
        const { entitlements } = await build(em, planOf(), workspaceOf({ seatCount: null }))

        await expect(entitlements.requireRoomForMember("ws-1")).resolves.toBeUndefined()
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a new member once the members fill the paid seats", async () => {
        const { entitlements } = await build(mockEntityManager({ query: [SELECT_ACTIVE_MEMBER_COUNT, [{ count: 3 }]] }))

        await expect(entitlements.requireRoomForMember("ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.SeatLimitReached,
        })
    })

    it("takes a new member while a seat is free, counting a missing row as none", async () => {
        const { entitlements } = await build(mockEntityManager({ query: [SELECT_ACTIVE_MEMBER_COUNT, []] }))

        await expect(entitlements.requireRoomForMember("ws-1")).resolves.toBeUndefined()
    })
})

describe("EntitlementsService > requireStorageFor", () => {
    it("refuses an upload that passes the storage of the plan, naming the quota in GB", async () => {
        const { entitlements } = await build(
            mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: 5 * GB - 10 }]] }),
        )

        await expect(entitlements.requireStorageFor("ws-1", 11)).rejects.toMatchObject({
            code: BillingErrorCode.StorageQuotaExceeded,
            params: { quotaGb: 5 },
        })
    })

    it("takes an upload of unknown size that still fits, and any upload on a plan without a quota", async () => {
        const fits = await build(mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: GB }]] }))
        const unlimited = await build(
            mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: 99 * GB }]] }),
            planOf({ storageGb: null }),
        )

        await expect(fits.entitlements.requireStorageFor("ws-1", -1)).resolves.toBeUndefined()
        await expect(unlimited.entitlements.requireStorageFor("ws-1", GB)).resolves.toBeUndefined()
    })
})

describe("EntitlementsService > storageOf", () => {
    it("answers the used bytes and the quota of the plan to a member", async () => {
        const { entitlements, billing } = await build(
            mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: 1234 }]] }),
        )

        await expect(entitlements.storageOf("user-1", "ws-1")).resolves.toEqual({
            usedBytes: 1234,
            quotaBytes: 5 * GB,
        })
        expect(billing.requireMember).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("answers no stored bytes and no quota for a workspace without a plan", async () => {
        const { entitlements } = await build(
            mockEntityManager({ query: [SELECT_STORAGE_BYTES, []] }),
            null,
            workspaceOf({ planCode: null }),
        )

        await expect(entitlements.storageOf("user-1", "ws-1")).resolves.toEqual({ usedBytes: 0, quotaBytes: null })
    })

    it("does not query storage when membership is refused", async () => {
        const em = mockEntityManager()
        const { entitlements, billing } = await build(em)
        const failure = { code: BillingErrorCode.NotMember }
        billing.requireMember.mockRejectedValue(failure)

        await expect(entitlements.storageOf("user-1", "ws-1")).rejects.toBe(failure)
        expect(billing.requireMember).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("EntitlementsService", () => {
    it("treats absent member and invitation counts as zero", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_MEMBER_COUNT, []],
                [SELECT_PENDING_INVITE_COUNT, []],
            ],
        })
        const { entitlements } = await build(em)

        await expect(entitlements.requireRoomForInvite("ws-1")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(SELECT_ACTIVE_MEMBER_COUNT, ["ws-1"])
        expect(em.query).toHaveBeenCalledWith(SELECT_PENDING_INVITE_COUNT, ["ws-1", NOW])
    })

    it("does not limit invitations when a workspace stops tracking paid seats", async () => {
        const em = mockEntityManager()
        const { entitlements, billing } = await build(em)
        billing.findWorkspaceBilling.mockResolvedValueOnce(workspaceOf()).mockResolvedValueOnce(null)

        await expect(entitlements.requireRoomForInvite("ws-1")).resolves.toBeUndefined()
        expect(billing.findWorkspaceBilling).toHaveBeenCalledTimes(2)
        expect(em.query).not.toHaveBeenCalled()
    })

    it("accepts an upload that exactly fills the quota", async () => {
        const em = mockEntityManager({ query: [SELECT_STORAGE_BYTES, [{ bytes: 5 * GB - 10 }]] })
        const { entitlements } = await build(em)

        await expect(entitlements.requireStorageFor("ws-1", 10)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(SELECT_STORAGE_BYTES, ["ws-1"])
    })
})

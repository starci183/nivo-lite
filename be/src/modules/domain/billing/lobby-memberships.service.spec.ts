import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { BillingService } from "./billing.service"
import type { Plan } from "./billing.contracts"
import { LobbyMembershipsService } from "./lobby-memberships.service"

/** The lobby facts of a living workspace whose seat is on. */
const LIVING = {
    deletedAt: null,
    restoreBefore: null,
    disabledAt: null,
    disabledByName: null,
    disabledByRole: null,
    disabledNote: null,
}

const membershipOf = builder<WorkspaceMembership>({
    workspace: {
        id: "ws-1",
        name: "Spa Hoa Mai",
        status: "active",
        ownerId: "user-1",
        createdAt: "2026-10-01T00:00:00.000Z",
        businessType: "spa",
    },
    member: {
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Linh",
        status: "active",
    },
    lobby: {
        planCode: "max",
        seatCount: null,
        memberCount: 4,
        ownerCount: 1,
        lastOpenedAt: "2026-11-09T07:00:00.000Z",
        ...LIVING,
    },
})

const MAX = builder<Plan>({
    code: "max",
    nameVi: "Max",
    nameEn: "Max",
    priceVnd: 990000,
    period: "month",
    seats: 5,
    features: { vi: [], en: [] },
    sort: 1,
    aiCreditsPerMonth: null,
    isCustom: false,
    priceAnnualVnd: null,
    annualDiscountPct: null,
    promoPriceVnd: null,
    promoMonths: null,
    storageGb: null,
    individual: false,
    perSeat: false,
    listed: true,
    tiers: [],
    packs: [],
})()

const build = async () => {
    const workspaces = mock<WorkspacesService>()
    const billing = mock<BillingService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LobbyMembershipsService,
            { provide: WorkspacesService, useValue: workspaces },
            { provide: BillingService, useValue: billing },
        ],
    }).compile()
    return { service: moduleRef.get(LobbyMembershipsService), workspaces, billing }
}

describe("LobbyMembershipsService > memberships", () => {
    it("names each workspace's plan and its seat limit, reading each plan once", async () => {
        const { service, workspaces, billing } = await build()
        workspaces.memberships.mockResolvedValue([
            membershipOf(),
            membershipOf({
                lobby: { planCode: "max", seatCount: 8, memberCount: 2, ownerCount: 2, lastOpenedAt: null, ...LIVING },
            }),
        ])
        billing.findPlan.mockResolvedValue(MAX)

        const answered = await service.memberships("user-1")

        expect(answered.map((entry) => entry.lobby)).toEqual([
            {
                planCode: "max",
                planNameVi: "Max",
                planNameEn: "Max",
                memberCount: 4,
                ownerCount: 1,
                seatLimit: 5,
                lastOpenedAt: "2026-11-09T07:00:00.000Z",
                ...LIVING,
            },
            {
                planCode: "max",
                planNameVi: "Max",
                planNameEn: "Max",
                memberCount: 2,
                ownerCount: 2,
                seatLimit: 8,
                lastOpenedAt: null,
                ...LIVING,
            },
        ])
        expect(billing.findPlan).toHaveBeenCalledTimes(1)
        expect(billing.findPlan).toHaveBeenCalledWith("max")
    })

    it("names no plan before the first payment or for a retired plan", async () => {
        const { service, workspaces, billing } = await build()
        workspaces.memberships.mockResolvedValue([
            membershipOf({
                lobby: {
                    planCode: null,
                    seatCount: null,
                    memberCount: 1,
                    ownerCount: 1,
                    lastOpenedAt: null,
                    ...LIVING,
                },
            }),
            membershipOf({
                lobby: {
                    planCode: "old",
                    seatCount: null,
                    memberCount: 1,
                    ownerCount: 1,
                    lastOpenedAt: null,
                    ...LIVING,
                },
            }),
        ])
        billing.findPlan.mockResolvedValue(null)

        const answered = await service.memberships("user-1")

        expect(answered.map((entry) => [entry.lobby.planNameVi, entry.lobby.seatLimit])).toEqual([
            [null, null],
            [null, null],
        ])
        expect(billing.findPlan).toHaveBeenCalledWith("old")
        expect(answered[0]?.workspace.name).toBe("Spa Hoa Mai")
    })
})

import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { LoyaltyOverviewService } from "./loyalty-overview.service"
import { LoyaltyBoardService } from "./loyalty-board.service"
import type { LoyaltyOverview } from "./loyalty.contracts"

const actorOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Mai",
    status: "active",
})
const PROGRAM: LoyaltyProgram = {
    workspaceId: "ws-1",
    slug: "shop",
    name: "Shop rewards",
    enabled: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    config: {
        earn: { perThousandVnd: 1, perVisit: 2, categories: [], trigger: "payment", minOrderVnd: 0 },
        tiers: [],
        expiry: { months: 12, warnDays: 30 },
        birthday: { enabled: true, points: 100, rewardKey: "gift", note: "Birthday gift" },
        promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
    },
}
const OVERVIEW: LoyaltyOverview = {
    stats: {
        members: 1,
        active90d: 1,
        pointsOutstanding: 50,
        earned30d: 100,
        redeemed30d: 50,
        expired30d: 0,
        redemptions30d: 1,
        spend30d: 100000,
        rewardValue30d: 50000,
        promosSent30d: 2,
        birthdaysThisMonth: 1,
        tierCounts: [],
    },
    figures: {
        members: 1,
        activeMembers: 1,
        pointsIssued30d: 100,
        redemptions30d: 1,
        pointsRedeemed30d: 50,
        atRisk: 0,
    },
    nowIso: "2026-10-14T00:00:00.000Z",
}
const MEMBERS: ReadonlyArray<LoyaltyMember> = [
    {
        id: "customer-1",
        name: "Lan",
        phone: "84912345678",
        email: null,
        birthday: "1990-10-10",
        tierKey: null,
        points: 50,
        lifetimeSpendVnd: 100000,
        visits: 1,
        lastVisitAt: "2026-10-13T00:00:00.000Z",
        joinedAt: "2026-10-01T00:00:00.000Z",
        note: "Regular customer",
    },
]
const REWARDS: ReadonlyArray<LoyaltyReward> = [
    {
        id: "reward-1",
        key: "gift",
        name: "Gift",
        kind: "item",
        valueVnd: 50000,
        percent: null,
        pointsCost: 50,
        stock: 10,
        perCustomerLimit: 1,
        minTierKey: null,
        note: "Birthday gift",
        active: true,
    },
]
const CAMPAIGNS: ReadonlyArray<LoyaltyCampaignView> = [
    {
        id: "campaign-1",
        name: "Birthday",
        segment: { tiers: [], inactiveDays: 0, birthdayThisMonth: true, minSpendVnd: 0 },
        messageDraft: "Happy birthday, {{customer}}",
        draft: "Happy birthday, {{customer}}",
        status: "draft",
        workItemId: null,
        recipients: 1,
        sent: 0,
        queued: 0,
        failed: 0,
        skipped: 0,
        draftMs: 10,
        createdBy: "Mai",
        createdAt: "2026-10-14T00:00:00.000Z",
        finishedAt: null,
        errorCode: null,
    },
]

const build = async () => {
    const access = mock<WorkspaceMembersService>()
    const overview = mock<LoyaltyOverviewService>()
    const programs = mock<LoyaltyProgramsService>()
    const ledger = mock<LoyaltyLedgerService>()
    const rewards = mock<LoyaltyRewardsService>()
    const campaigns = mock<LoyaltyCampaignsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyBoardService,
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyOverviewService, useValue: overview },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyRewardsService, useValue: rewards },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyBoardService), access, overview, programs, ledger, rewards, campaigns }
}

describe("LoyaltyBoardService", () => {
    describe("board", () => {
        it("board has its first case written", async () => {
            const { service } = await build()
            expect(service.board).toBeInstanceOf(Function)
        })

        it.each([
            { role: "owner", canManage: true },
            { role: "manager", canManage: true },
            { role: "staff", canManage: false },
        ] as const)("composes the board for $role with management access $canManage", async ({ role, canManage }) => {
            const { service, access, overview, programs, ledger, rewards, campaigns } = await build()
            access.require.mockResolvedValue(actorOf({ role }))
            overview.overview.mockResolvedValue(OVERVIEW)
            programs.find.mockResolvedValue(PROGRAM)
            programs.configOf.mockResolvedValue(PROGRAM.config)
            ledger.members.mockResolvedValue(MEMBERS)
            rewards.list.mockResolvedValue(REWARDS)
            campaigns.list.mockResolvedValue(CAMPAIGNS)

            expect(await service.board("user-1", { workspaceId: "ws-1" })).toEqual({
                ...OVERVIEW,
                program: PROGRAM,
                config: PROGRAM.config,
                members: MEMBERS,
                rewards: REWARDS,
                campaigns: CAMPAIGNS,
                canManage,
            })
            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(overview.overview).toHaveBeenCalledWith("user-1", { workspaceId: "ws-1" })
            expect(programs.find).toHaveBeenCalledWith("ws-1")
            expect(programs.configOf).toHaveBeenCalledWith("ws-1")
            expect(ledger.members).toHaveBeenCalledWith("ws-1")
            expect(rewards.list).toHaveBeenCalledWith("ws-1", false)
            expect(campaigns.list).toHaveBeenCalledWith("ws-1", 20)
        })

        it("does not read board data when membership is refused", async () => {
            const { service, access, overview, programs, ledger, rewards, campaigns } = await build()
            const refusal = { code: "WORKSPACE_MEMBERS_FORBIDDEN" }
            access.require.mockRejectedValue(refusal)

            await expect(service.board("user-1", { workspaceId: "ws-1" })).rejects.toBe(refusal)
            expect(overview.overview).not.toHaveBeenCalled()
            expect(programs.find).not.toHaveBeenCalled()
            expect(programs.configOf).not.toHaveBeenCalled()
            expect(ledger.members).not.toHaveBeenCalled()
            expect(rewards.list).not.toHaveBeenCalled()
            expect(campaigns.list).not.toHaveBeenCalled()
        })
    })

    describe("program", () => {
        it("program has its first case written", async () => {
            const { service } = await build()
            expect(service.program).toBeInstanceOf(Function)
        })

        it.each([PROGRAM, null])("returns settings and only active reward choices", async (program) => {
            const { service, access, programs, rewards, overview, ledger, campaigns } = await build()
            access.require.mockResolvedValue(actorOf({ role: "staff" }))
            programs.find.mockResolvedValue(program)
            programs.configOf.mockResolvedValue(PROGRAM.config)
            rewards.list.mockResolvedValue(REWARDS)

            expect(await service.program("user-1", { workspaceId: "ws-1" })).toEqual({
                program,
                config: PROGRAM.config,
                rewards: REWARDS,
            })
            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(programs.find).toHaveBeenCalledWith("ws-1")
            expect(programs.configOf).toHaveBeenCalledWith("ws-1")
            expect(rewards.list).toHaveBeenCalledWith("ws-1", true)
            expect(overview.overview).not.toHaveBeenCalled()
            expect(ledger.members).not.toHaveBeenCalled()
            expect(campaigns.list).not.toHaveBeenCalled()
        })

        it("does not read settings when membership is refused", async () => {
            const { service, access, programs, rewards } = await build()
            const refusal = { code: "WORKSPACE_MEMBERS_FORBIDDEN" }
            access.require.mockRejectedValue(refusal)

            await expect(service.program("user-1", { workspaceId: "ws-1" })).rejects.toBe(refusal)
            expect(programs.find).not.toHaveBeenCalled()
            expect(programs.configOf).not.toHaveBeenCalled()
            expect(rewards.list).not.toHaveBeenCalled()
        })
    })
})

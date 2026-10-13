import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LoyaltyOverviewService } from "./loyalty-overview.service"

const NOW = Date.UTC(2026, 9, 12)
const CONFIG: LoyaltyConfig = {
    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
    tiers: [{ key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" }],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 40,
    lifetimeSpendVnd: 0,
    visits: 1,
    lastVisitAt: new Date(NOW - 86_400_000).toISOString(),
    joinedAt: new Date(NOW - 200 * 86_400_000).toISOString(),
    note: "",
})

describe("LoyaltyOverviewService", () => {
    it("asks for membership, then reads the members, the last 30 days of the ledger and the promotions sent", async () => {
        const access = mock<WorkspaceMembersService>()
        const ledger = mock<LoyaltyLedgerService>()
        ledger.members.mockResolvedValue([memberOf()])
        ledger.totalsSince.mockResolvedValue([{ kind: "earn", entries: 2, points: 90, amountVnd: 90000 }])
        const campaigns = mock<LoyaltyCampaignsService>()
        campaigns.sentSince.mockResolvedValue(3)
        const programs = mock<LoyaltyProgramsService>()
        programs.configOf.mockResolvedValue(CONFIG)
        const moduleRef = await Test.createTestingModule({
            providers: [
                LoyaltyOverviewService,
                { provide: CLOCK, useValue: new FakeClock(NOW) },
                { provide: WorkspaceMembersService, useValue: access },
                { provide: LoyaltyLedgerService, useValue: ledger },
                { provide: LoyaltyProgramsService, useValue: programs },
                { provide: LoyaltyCampaignsService, useValue: campaigns },
            ],
        }).compile()

        const overview = await moduleRef.get(LoyaltyOverviewService).overview("user-1", { workspaceId: "ws-1" })

        expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(ledger.totalsSince).toHaveBeenCalledWith("ws-1", new Date(NOW - 30 * 86_400_000).toISOString())
        expect(overview.nowIso).toBe(new Date(NOW).toISOString())
        expect(overview.stats).toMatchObject({
            members: 1,
            pointsOutstanding: 40,
            earned30d: 90,
            spend30d: 90000,
            promosSent30d: 3,
            tierCounts: [{ key: "dong", name: "Bronze", count: 1 }],
        })
        expect(overview.figures).toMatchObject({ members: 1, activeMembers: 1, pointsIssued30d: 90, atRisk: 0 })
    })
})

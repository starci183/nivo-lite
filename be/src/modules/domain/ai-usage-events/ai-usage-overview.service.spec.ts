import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { QuotaStatus, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageOverviewService } from "./ai-usage-overview.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "An",
    status: "active",
}

const QUOTA: QuotaStatus = {
    periodStart: "2026-10-01",
    messagesUsed: 2,
    tokensUsed: 30,
    costUsd: 0.1,
    messagesLimit: 100,
    tokensLimit: 1000,
    fallbackReply: null,
    creditsUsed: 4,
    creditsLimit: 20,
    creditsCarried: 0,
    topupBalance: 1,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.2,
    level: "ok",
}

const SUMMARY: UsageSummary = {
    status: QUOTA,
    byModule: [{ module: "chat", calls: 2, tokens: 30, costUsd: 0.1, credits: 4 }],
    daily: [{ day: "2026-10-13", tokens: 30, credits: 4 }],
}

const build = async () => {
    const usage = mock<AiUsageEventsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiUsageOverviewService,
            { provide: AiUsageEventsService, useValue: usage },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { overview: moduleRef.get(AiUsageOverviewService), usage, members }
}

describe("AiUsageOverviewService", () => {
    it("returns the current quota for any active member", async () => {
        const { overview, usage, members } = await build()
        usage.readQuotaStatus.mockResolvedValue(QUOTA)

        await expect(overview.quotaStatus("user-1", "ws-1")).resolves.toEqual(QUOTA)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("returns the billing summary for an owner or manager", async () => {
        const { overview, usage, members } = await build()
        usage.usageSummary.mockResolvedValue(SUMMARY)

        await expect(overview.usageSummary("user-1", "ws-1")).resolves.toEqual(SUMMARY)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
    })

    it("returns the recent model cost for any active member", async () => {
        const { overview, usage } = await build()
        usage.recentCostUsd.mockResolvedValue(1.25)

        await expect(overview.recentCostUsd("user-1", "ws-1", "2026-10-01")).resolves.toBe(1.25)
        expect(usage.recentCostUsd).toHaveBeenCalledWith("ws-1", "2026-10-01")
    })
})

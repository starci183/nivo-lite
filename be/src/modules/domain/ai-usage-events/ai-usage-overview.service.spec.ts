import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { QuotaStatus, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageOverviewService } from "./ai-usage-overview.service"

const USER = "user-1"
const WORKSPACE = "ws-1"

const MEMBER: WorkspaceMember = {
    userId: USER,
    workspaceId: WORKSPACE,
    role: "owner",
    staffId: null,
    displayName: "Owner",
    status: "active",
}

const statusOf = builder<QuotaStatus>({
    periodStart: "2026-10-01",
    messagesUsed: 80,
    tokensUsed: 1000,
    costUsd: 0.4,
    messagesLimit: 100,
    tokensLimit: 10000,
    fallbackReply: "Vui l\u00f2ng ch\u1edd",
    creditsUsed: 100,
    creditsLimit: 200,
    creditsCarried: 20,
    topupBalance: 50,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.8,
    level: "warn",
})

const build = async () => {
    const usage = mock<AiUsageEventsService>()
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiUsageOverviewService,
            { provide: AiUsageEventsService, useValue: usage },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AiUsageOverviewService), usage, members }
}

describe("AiUsageOverviewService", () => {
    describe("quotaStatus", () => {
        it("answers the month's quota to any active member", async () => {
            const { service, usage, members } = await build()
            usage.readQuotaStatus.mockResolvedValue(statusOf())

            await expect(service.quotaStatus(USER, WORKSPACE)).resolves.toEqual(statusOf())

            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE)
        })

        it("reads nothing for someone who is not a member", async () => {
            const { service, usage, members } = await build()
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(service.quotaStatus(USER, WORKSPACE)).rejects.toBe(refusal)
            expect(usage.readQuotaStatus).not.toHaveBeenCalled()
        })
    })

    describe("usageSummary", () => {
        it("answers the summary to an owner or a manager only", async () => {
            const { service, usage, members } = await build()
            const summary: UsageSummary = { status: null, byModule: [], daily: [] }
            usage.usageSummary.mockResolvedValue(summary)

            await expect(service.usageSummary(USER, WORKSPACE)).resolves.toEqual(summary)

            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
        })
    })

    describe("recentCostUsd", () => {
        it("answers the cost since the chosen day", async () => {
            const { service, usage } = await build()
            usage.recentCostUsd.mockResolvedValue(1.25)

            await expect(service.recentCostUsd(USER, WORKSPACE, "2026-10-01")).resolves.toBe(1.25)

            expect(usage.recentCostUsd).toHaveBeenCalledWith(WORKSPACE, "2026-10-01")
        })
    })
})

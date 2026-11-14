import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { QuotaStatus, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageOverviewService } from "./ai-usage-overview.service"
import { AiWorkUsageService } from "./ai-work-usage.service"
import type { WorkKindUsage } from "./work-usage.contracts"

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
    const work = mock<AiWorkUsageService>()
    work.byRefs.mockResolvedValue(new Map())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiUsageOverviewService,
            { provide: AiUsageEventsService, useValue: usage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AiWorkUsageService, useValue: work },
        ],
    }).compile()
    return { service: moduleRef.get(AiUsageOverviewService), usage, members, work }
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

    describe("the cost of AI work (owner and manager only)", () => {
        const kindOf = (ref: string, workKind: string, costUsd: number): WorkKindUsage => ({
            ref,
            workKind,
            calls: 1,
            failedTries: 0,
            tokens: 1000,
            costUsd,
            failedCostUsd: 0,
            credits: 0,
            models: ["claude-haiku-5-5"],
        })

        it("documents: read, critique and re-read per document, exact credits, one read per 100 documents", async () => {
            const { service, work } = await build()
            work.byRefs.mockResolvedValueOnce(
                new Map([
                    [
                        "source:s1",
                        [
                            kindOf("source:s1", "document_read", 0.00113),
                            kindOf("source:s1", "document_critique", 0.0113),
                            kindOf("source:s1", "document_reread", 0.000565),
                        ],
                    ],
                ]),
            )
            const ids = ["s1", ...Array.from({ length: 120 }, (_, index) => `x${index}`)]

            const costs = await service.documentCosts(USER, WORKSPACE, ids)

            expect(costs?.get("s1")).toMatchObject({
                read: { calls: 1, credits: 1 },
                critique: { calls: 1, credits: 10 },
                reread: { calls: 1, credits: 0.5 },
                total: { calls: 3, credits: 11.5 },
            })
            expect(costs?.get("x0")?.total).toMatchObject({ calls: 0, credits: 0 })
            expect(work.byRefs).toHaveBeenCalledTimes(2)
            expect(work.byRefs.mock.calls[0]?.[1]).toHaveLength(100)
        })

        it("staff see no credits: the documents list stays open to them, its costs are null and nothing is read", async () => {
            const { service, work, members } = await build()
            members.require.mockResolvedValue({ ...MEMBER, role: "staff" })

            await expect(service.documentCosts(USER, WORKSPACE, ["s1"])).resolves.toBeNull()
            await expect(service.lessonsCost(USER, WORKSPACE, ["c1"])).resolves.toBeNull()
            expect(work.byRefs).not.toHaveBeenCalled()
        })

        it("a learning proposal: the sum of its lessons' calls (judgements and the draft), exact", async () => {
            const { service, work } = await build()
            work.byRefs.mockResolvedValue(
                new Map([
                    ["lesson:c1", [kindOf("lesson:c1", "learning", 0.000113)]],
                    ["lesson:c2", [kindOf("lesson:c2", "learning", 0.000226)]],
                ]),
            )

            await expect(service.lessonsCost(USER, WORKSPACE, ["c1", "c2", "c1"])).resolves.toMatchObject({
                calls: 2,
                credits: 0.3,
                costUsd: 0.000339,
            })
            expect(work.byRefs).toHaveBeenCalledWith(WORKSPACE, ["lesson:c1", "lesson:c2"])
        })
    })
})

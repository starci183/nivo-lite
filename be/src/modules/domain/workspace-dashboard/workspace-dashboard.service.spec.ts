import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import type { AgentSummary } from "@modules/domain/agents"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import type { QuotaLookup } from "@modules/domain/ai-usage-events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsDashboardReadService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import type { RecordsFacts } from "./workspace-dashboard.contracts"
import { WorkspaceDashboardService } from "./workspace-dashboard.service"

const NOW = "2026-11-09T05:00:00.000Z"

const FACTS: RecordsFacts = {
    revenueVnd: { current: 3_120_000, previous: 2_640_000 },
    matchedPayments: 38,
    ordersPlaced: { current: 46, previous: 37 },
    ordersPaid: { current: 41, previous: 36 },
    leads: { current: 120, previous: 100 },
    leadsConsulted: { current: 96, previous: 80 },
    channels: [{ channel: "zalo", leads: 21, revenueVnd: 1_900_000 }],
    days: [{ day: "2026-11-09", revenueVnd: 750_000, orders: 9 }],
    messagesAnswered: 527,
    failedRunsByAgent: new Map([["a-1", 1]]),
}

const AGENT = {
    id: "a-1",
    module: "sales",
    name: "Sales",
    handle: "sales",
    role: "",
    status: "active",
    avatarUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
} satisfies AgentSummary

const QUOTA = builder<NonNullable<QuotaLookup>>({
    periodStart: "2026-11-01",
    messagesUsed: 0,
    tokensUsed: 0,
    costUsd: 0,
    messagesLimit: null,
    tokensLimit: null,
    fallbackReply: null,
    creditsUsed: 686,
    creditsLimit: 2000,
    creditsCarried: 0,
    topupBalance: 0,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.34,
    level: "ok",
})

const build = async (role: "owner" | "staff" = "owner") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation((_user, _workspace, roles) => {
        if (roles !== undefined && !roles.includes(role)) return Promise.reject(new Error("forbidden"))
        return Promise.resolve({
            userId: "u-1",
            workspaceId: "ws-1",
            role,
            staffId: null,
            displayName: "Owner",
            status: "active" as const,
        })
    })
    const records = mock<DashboardRecordsReadService>()
    records.read.mockResolvedValue(FACTS)
    const items = mock<WorkItemsDashboardReadService>()
    items.activityOf.mockResolvedValue([
        {
            department: "sales",
            installationId: null,
            action: "confirm_order",
            done: 10,
            autoDone: 8,
            failed: 1,
            previousDone: 10,
            previousAutoDone: 5,
        },
    ])
    items.responseTimesOf.mockResolvedValue([{ department: "sales", installationId: null, medianSeconds: 41 }])
    items.waitingOf.mockResolvedValue([{ department: "sales", installationId: null, waiting: 2 }])
    items.waitingApprovalsOf.mockResolvedValue({
        total: 2,
        items: [
            {
                id: "w-1",
                department: "sales",
                installationId: null,
                action: "confirm_order",
                createdAt: "2026-11-09T01:00:00.000Z",
                summary: "Order DH-1",
                customer: null,
            },
        ],
    })
    const usage = mock<AiUsageEventsService>()
    usage.creditsByModule.mockResolvedValue(new Map([["sales", 210]]))
    usage.readQuotaStatus.mockResolvedValue(QUOTA())
    const agents = mock<AgentsService>()
    agents.list.mockResolvedValue([AGENT])
    const installations = mock<InstallationRecordsService>()
    installations.list.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceDashboardService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DashboardRecordsReadService, useValue: records },
            { provide: WorkItemsDashboardReadService, useValue: items },
            { provide: AiUsageEventsService, useValue: usage },
            { provide: AgentsService, useValue: agents },
            { provide: InstallationRecordsService, useValue: installations },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceDashboardService), members, records, items, usage }
}

describe("WorkspaceDashboardService > read", () => {
    it("lets only an owner or a manager read, and reads nothing for anyone else", async () => {
        const { service, records } = await build("staff")

        await expect(service.read("u-1", "ws-1", "last_7_days")).rejects.toThrow("forbidden")
        expect(records.read).not.toHaveBeenCalled()
    })

    it("hands every read the window of the period, the period before as the comparison", async () => {
        const { service, records, items, usage } = await build()

        const data = await service.read("u-1", "ws-1", "last_7_days")

        expect(data.window.from.toISOString()).toBe("2026-11-02T17:00:00.000Z")
        expect(records.read).toHaveBeenCalledWith("ws-1", data.window)
        expect(items.activityOf).toHaveBeenCalledWith("ws-1", {
            from: data.window.from,
            to: data.window.to,
            previousFrom: data.window.previousFrom,
        })
        expect(usage.creditsByModule).toHaveBeenCalledWith("ws-1", data.window.from, data.window.to)
    })

    it("computes the headline figures", async () => {
        const { service } = await build()

        const data = await service.read("u-1", "ws-1", "last_7_days")

        expect(data.revenue).toEqual({ current: 3_120_000, previous: 2_640_000 })
        expect(data.orders).toEqual({ current: 46, previous: 37 })
        expect(data.newCustomers).toEqual({ current: 120, previous: 100 })
        expect(data.closeRate.current).toBeCloseTo(41 / 120)
        expect(data.closeRate.previous).toBeCloseTo(0.36)
        expect(data.agentAutoRate).toEqual({ current: 0.8, previous: 0.5 })
        expect(data.funnel).toEqual({ visitors: 120, consulted: 96, ordered: 46, paid: 41 })
    })

    it("lists what waits for the owner with the agent named and the item's path", async () => {
        const { service } = await build()

        const { approvals } = await service.read("u-1", "ws-1", "last_7_days")

        expect(approvals.total).toBe(2)
        expect(approvals.items).toEqual([
            {
                id: "w-1",
                agentName: "Sales",
                action: "confirm_order",
                summary: "Order DH-1",
                customer: null,
                createdAt: "2026-11-09T01:00:00.000Z",
                href: "/agents/sales/workbench?focus=w-1",
            },
        ])
    })
})

describe("WorkspaceDashboardService > what the agents did", () => {
    it("sums what the agents did with the minutes of the table, and reads the month's credits", async () => {
        const { service } = await build()

        const { savings } = await service.read("u-1", "ws-1", "last_7_days")

        expect(savings).toEqual({
            minutesSaved: 50,
            lines: [{ action: "confirm_order", count: 10, minutesEach: 5 }],
            defaultMinutes: 2,
            messagesAnswered: 527,
            ordersCreated: 46,
            paymentsMatched: 38,
            creditsUsed: 686,
            creditsLimit: 2000,
        })
    })

    it("has one table row per agent with its own figures", async () => {
        const { service } = await build()

        const { agents } = await service.read("u-1", "ws-1", "last_7_days")

        expect(agents).toEqual([
            {
                agentId: "a-1",
                name: "Sales",
                handle: "sales",
                module: "sales",
                tasksDone: 10,
                autoRate: 0.8,
                waiting: 2,
                errors: 2,
                medianResponseSeconds: 41,
                minutesSaved: 50,
                credits: 210,
            },
        ])
    })
})

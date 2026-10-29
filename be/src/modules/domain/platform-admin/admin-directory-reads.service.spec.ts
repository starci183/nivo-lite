import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AiQuotaOverridesAdminReadService } from "@modules/domain/ai-quota-overrides"
import { AppErrorsReadService } from "@modules/domain/app-errors"
import { BillingEventsReadService } from "@modules/domain/billing"
import { ConnectionsAdminReadService } from "@modules/domain/connections"
import { KnowledgeSourcesAdminReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsAdminReadService } from "@modules/domain/module-context-versions"
import { ModuleInstallationsAdminReadService } from "@modules/domain/module-installations"
import { AgentSyncAdminReadService } from "@modules/domain/openclaw-agent-sync"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { SepayTransactionsAdminReadService } from "@modules/domain/sepay-transactions"
import { WorkspaceInvitesAdminReadService } from "@modules/domain/workspace-invites"
import { MemberRosterService } from "@modules/domain/workspace-members"
import { WorkspaceAdminReadService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AdminDirectoryReadsService } from "./admin-directory-reads.service"

/** The statements `callDbFunction` runs for the database functions. */
const WORKSPACE_STATS = "SELECT * FROM public.admin_workspace_stats()"
const USER_EMAILS = "SELECT * FROM be_access.user_emails($1)"
const QUOTA_STATUS = "SELECT * FROM public.ai_quota_status($1)"
const SIGNUPS = "SELECT * FROM public.admin_signups_per_day($1)"

const AT = new Date("2026-10-12T03:00:00.000Z")
const ISO = "2026-10-12T03:00:00.000Z"

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const workspaces = mock<WorkspaceAdminReadService>()
    const installations = mock<ModuleInstallationsAdminReadService>()
    const connections = mock<ConnectionsAdminReadService>()
    const appErrors = mock<AppErrorsReadService>()
    const roster = mock<MemberRosterService>()
    const invites = mock<WorkspaceInvitesAdminReadService>()
    const orders = mock<PaymentOrdersService>()
    const billingEvents = mock<BillingEventsReadService>()
    const contextVersions = mock<ContextVersionsAdminReadService>()
    const agentSync = mock<AgentSyncAdminReadService>()
    const knowledge = mock<KnowledgeSourcesAdminReadService>()
    const transfers = mock<SepayTransactionsAdminReadService>()
    const quota = mock<AiQuotaOverridesAdminReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminDirectoryReadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceAdminReadService, useValue: workspaces },
            { provide: ModuleInstallationsAdminReadService, useValue: installations },
            { provide: ConnectionsAdminReadService, useValue: connections },
            { provide: AppErrorsReadService, useValue: appErrors },
            { provide: MemberRosterService, useValue: roster },
            { provide: WorkspaceInvitesAdminReadService, useValue: invites },
            { provide: PaymentOrdersService, useValue: orders },
            { provide: BillingEventsReadService, useValue: billingEvents },
            { provide: ContextVersionsAdminReadService, useValue: contextVersions },
            { provide: AgentSyncAdminReadService, useValue: agentSync },
            { provide: KnowledgeSourcesAdminReadService, useValue: knowledge },
            { provide: SepayTransactionsAdminReadService, useValue: transfers },
            { provide: AiQuotaOverridesAdminReadService, useValue: quota },
        ],
    }).compile()
    const service = moduleRef.get(AdminDirectoryReadsService)
    const owners = { workspaces, installations, connections, appErrors, roster, invites, orders }
    return { service, ...owners, billingEvents, contextVersions, agentSync, knowledge, transfers, quota }
}
}

const WORKSPACE_ROW = {
    id: "ws-1",
    ownerId: "u-1",
    name: "Spa",
    status: "active",
    planCode: "pro",
    paidUntil: AT,
    createdAt: AT,
}
const WORKSPACE_FACTS = {
    id: "ws-1",
    owner_id: "u-1",
    name: "Spa",
    status: "active",
    plan_code: "pro",
    paid_until: ISO,
    created_at: ISO,
}

const orderOf = (id: string): PaymentOrder => ({
    id,
    workspaceId: "ws-1",
    planCode: "pro",
    amountVnd: 100,
    orderCode: `NIVO${id}`,
    status: "paid",
    expiresAt: ISO,
    paidAt: ISO,
    createdAt: ISO,
    kind: "plan",
    packCode: null,
    detail: {},
})

describe("AdminDirectoryReadsService workspaces", () => {
    it("lists the newest 1000 workspaces as facts, with the paid-until instant only when there is one", async () => {
        const { service, workspaces } = await build()
        workspaces.newest.mockResolvedValue([WORKSPACE_ROW, { ...WORKSPACE_ROW, paidUntil: null }])

        await expect(service.workspaces()).resolves.toEqual([WORKSPACE_FACTS, { ...WORKSPACE_FACTS, paid_until: null }])
        expect(workspaces.newest).toHaveBeenCalledWith(1000)
    })

    it("reads one workspace by id and answers undefined when it is gone", async () => {
        const { service, workspaces } = await build()
        workspaces.find.mockResolvedValueOnce(WORKSPACE_ROW).mockResolvedValueOnce(undefined)

        await expect(service.workspace("ws-1")).resolves.toEqual(WORKSPACE_FACTS)
        await expect(service.workspace("ws-9")).resolves.toBeUndefined()
        expect(workspaces.find).toHaveBeenCalledWith("ws-9")
    })

    it("names the given workspaces, bounded at 500", async () => {
        const { service, workspaces } = await build()
        workspaces.namesOf.mockResolvedValue([{ id: "ws-1", name: "Spa" }])

        await expect(service.workspaceNames(["ws-1"])).resolves.toEqual([{ id: "ws-1", name: "Spa" }])
        expect(workspaces.namesOf).toHaveBeenCalledWith(["ws-1"], 500)
    })
})

describe("AdminDirectoryReadsService installations and connections", () => {
    it("reads the installation badges of every workspace, bounded at 5000", async () => {
        const { service, installations } = await build()
        installations.badges.mockResolvedValue([
            { workspaceId: "ws-1", moduleKey: "chatbot", status: "ready", liveEnabled: true },
        ])

        await expect(service.moduleInstalls()).resolves.toEqual([
            { workspace_id: "ws-1", module_key: "chatbot", status: "ready", live_enabled: true },
        ])
        expect(installations.badges).toHaveBeenCalledWith(5000)
    })

    it("reads the installations of a workspace, bounded at 50", async () => {
        const { service, installations } = await build()
        installations.ofWorkspace.mockResolvedValue([
            {
                id: "in-1",
                moduleKey: "chatbot",
                status: "ready",
                operatingMode: "assist",
                liveEnabled: false,
                activeContextVersionId: "cv-1",
                processor: "openclaw",
            },
        ])

        await expect(service.installs("ws-1")).resolves.toEqual([
            {
                id: "in-1",
                module_key: "chatbot",
                status: "ready",
                operating_mode: "assist",
                live_enabled: false,
                active_context_version_id: "cv-1",
                processor: "openclaw",
            },
        ])
        expect(installations.ofWorkspace).toHaveBeenCalledWith("ws-1", 50)
    })
})

describe("AdminDirectoryReadsService connections", () => {
    it("reads the live connections, bounded at 5000, with the last event only when there is one", async () => {
        const { service, connections } = await build()
        const row = {
            workspaceId: "ws-1",
            provider: "zalo",
            status: "connected",
            environment: "live",
            lastEventAt: null,
            createdAt: AT,
        }
        connections.live.mockResolvedValue([row, { ...row, lastEventAt: AT }])

        await expect(service.liveConnections()).resolves.toEqual([
            {
                workspace_id: "ws-1",
                provider: "zalo",
                status: "connected",
                environment: "live",
                last_event_at: null,
                created_at: ISO,
            },
            expect.objectContaining({ last_event_at: ISO }),
        ])
        expect(connections.live).toHaveBeenCalledWith(5000)
    })

    it("reads the connections of a workspace, bounded at 200", async () => {
        const { service, connections } = await build()
        connections.ofWorkspace.mockResolvedValue([
            {
                id: "c-1",
                provider: "zalo",
                name: "Shop",
                status: "error",
                environment: "live",
                lastEventAt: AT,
                lastError: "401",
                createdAt: AT,
            },
        ])

        await expect(service.connections("ws-1")).resolves.toEqual([
            {
                id: "c-1",
                provider: "zalo",
                name: "Shop",
                status: "error",
                environment: "live",
                last_event_at: ISO,
                last_error: "401",
                created_at: ISO,
            },
        ])
        expect(connections.ofWorkspace).toHaveBeenCalledWith("ws-1", 200)
    })
})

describe("AdminDirectoryReadsService errors", () => {
    it("reads the workspaces of the errors since an instant, bounded at 5000", async () => {
        const { service, appErrors } = await build()
        appErrors.workspacesSince.mockResolvedValue(["ws-1"])

        await expect(service.errorWorkspaces(AT)).resolves.toEqual([{ workspace_id: "ws-1" }])
        expect(appErrors.workspacesSince).toHaveBeenCalledWith(AT, 5000)
    })

    it("reads the newest errors of a workspace, bounded at 20", async () => {
        const { service, appErrors } = await build()
        appErrors.latestOfWorkspace.mockResolvedValue([
            { id: "e-1", scope: "api.x", message: "boom", workspaceId: "ws-1", createdAt: AT },
        ])

        await expect(service.workspaceErrors("ws-1")).resolves.toEqual([
            { id: "e-1", scope: "api.x", message: "boom", created_at: ISO },
        ])
        expect(appErrors.latestOfWorkspace).toHaveBeenCalledWith("ws-1", 20)
    })

    it("reads the newest errors of every workspace, bounded at 50", async () => {
        const { service, appErrors } = await build()
        appErrors.latest.mockResolvedValue([
            { id: "e-1", scope: "api.x", message: "boom", workspaceId: null, createdAt: AT },
        ])

        await expect(service.recentErrors()).resolves.toEqual([
            { id: "e-1", scope: "api.x", message: "boom", workspace_id: null, created_at: ISO },
        ])
        expect(appErrors.latest).toHaveBeenCalledWith(50)
    })

    it("counts the errors since an instant by scope, bounded at 100", async () => {
        const { service, appErrors } = await build()
        appErrors.scopesSince.mockResolvedValue([{ scope: "api.x", count: 2 }])

        await expect(service.errorScopes(AT)).resolves.toEqual([{ key: "api.x", count: 2 }])
        expect(appErrors.scopesSince).toHaveBeenCalledWith(AT, 100)
    })
})

describe("AdminDirectoryReadsService workspace detail", () => {
    it("reads the members, bounded at 500", async () => {
        const { service, roster } = await build()
        roster.oldestOf.mockResolvedValue([
            { userId: "u-1", role: "owner", displayName: "An", status: "active", createdAt: AT },
        ])

        await expect(service.members("ws-1")).resolves.toEqual([
            { user_id: "u-1", role: "owner", display_name: "An", status: "active", created_at: ISO },
        ])
        expect(roster.oldestOf).toHaveBeenCalledWith("ws-1", 500)
    })

    it("reads the pending invitations, bounded at 200", async () => {
        const { service, invites } = await build()
        invites.pendingOf.mockResolvedValue([
            { id: "iv-1", email: "a@b.c", role: "staff", createdAt: AT, expiresAt: AT },
        ])

        await expect(service.pendingInvites("ws-1")).resolves.toEqual([
            { id: "iv-1", email: "a@b.c", role: "staff", created_at: ISO, expires_at: ISO },
        ])
        expect(invites.pendingOf).toHaveBeenCalledWith("ws-1", 200)
    })

    it("keeps the newest 30 of the payment orders", async () => {
        const { service, orders } = await build()
        orders.list.mockResolvedValue(Array.from({ length: 50 }, (_, index) => orderOf(String(index))))

        const facts = await service.orders("ws-1")

        expect(facts).toHaveLength(30)
        expect(facts[0]).toEqual({
            id: "0",
            order_code: "NIVO0",
            plan_code: "pro",
            amount_vnd: 100,
            status: "paid",
            created_at: ISO,
            paid_at: ISO,
        })
        expect(orders.list).toHaveBeenCalledWith("ws-1")
    })

    it("reads the billing events of a workspace, bounded at 20", async () => {
        const { service, billingEvents } = await build()
        billingEvents.latestOfWorkspace.mockResolvedValue([
            { id: "b-1", workspaceId: "ws-1", kind: "paid", createdAt: AT },
        ])

        await expect(service.billingEvents("ws-1")).resolves.toEqual([{ id: "b-1", kind: "paid", created_at: ISO }])
        expect(billingEvents.latestOfWorkspace).toHaveBeenCalledWith("ws-1", 20)
    })
})

describe("AdminDirectoryReadsService workspace detail: context and sync", () => {
    it("reads the context versions, bounded at 500", async () => {
        const { service, contextVersions } = await build()
        contextVersions.ofWorkspace.mockResolvedValue([{ id: "v-1", version: 3, appliedAt: AT }])

        await expect(service.contextVersions("ws-1")).resolves.toEqual([{ id: "v-1", version: 3, applied_at: ISO }])
        expect(contextVersions.ofWorkspace).toHaveBeenCalledWith("ws-1", 500)
    })

    it("reads the agent sync state, bounded at 50", async () => {
        const { service, agentSync } = await build()
        agentSync.ofWorkspace.mockResolvedValue([
            {
                installationId: "in-1",
                agentId: "ag-1",
                contextVersion: 2,
                checkedAt: AT,
                status: "ok",
                error: null,
            },
        ])

        await expect(service.agentSync("ws-1")).resolves.toEqual([
            {
                installation_id: "in-1",
                agent_id: "ag-1",
                context_version: 2,
                checked_at: ISO,
                status: "ok",
                error: null,
            },
        ])
        expect(agentSync.ofWorkspace).toHaveBeenCalledWith("ws-1", 50)
    })

    it("reads the knowledge sources, bounded at 5000", async () => {
        const { service, knowledge } = await build()
        knowledge.stagesOf.mockResolvedValue([{ kind: "faq", status: "ready" }])

        await expect(service.knowledgeSources("ws-1")).resolves.toEqual([{ kind: "faq", status: "ready" }])
        expect(knowledge.stagesOf).toHaveBeenCalledWith("ws-1", 5000)
    })

    it("reads the own credit allowance of one workspace and undefined when there is none", async () => {
        const { service, quota } = await build()
        quota.creditsOf.mockResolvedValueOnce({ creditsLimit: "2000" }).mockResolvedValueOnce(undefined)

        await expect(service.quotaOverride("ws-1")).resolves.toEqual({ credits_limit: "2000" })
        await expect(service.quotaOverride("ws-9")).resolves.toBeUndefined()
    })
})

describe("AdminDirectoryReadsService transfers and billing", () => {
    it("reads the transfers of the given orders, bounded at 30", async () => {
        const { service, transfers } = await build()
        transfers.matchedTo.mockResolvedValue([
            { sepayId: 7, transferAmount: 500, content: "NIVO1", status: "matched", receivedAt: AT },
        ])

        await expect(service.transfers(["ord-1"])).resolves.toEqual([
            { sepay_id: 7, transfer_amount: 500, content: "NIVO1", status: "matched", received_at: ISO },
        ])
        expect(transfers.matchedTo).toHaveBeenCalledWith(["ord-1"], 30)
    })

    it("reads the newest transfers, bounded at 25", async () => {
        const { service, transfers } = await build()
        transfers.latest.mockResolvedValue([
            { sepayId: 7, transferAmount: null, content: null, status: "received", receivedAt: AT },
        ])

        await expect(service.recentTransfers()).resolves.toEqual([
            { status: "received", transfer_amount: null, content: null, received_at: ISO },
        ])
        expect(transfers.latest).toHaveBeenCalledWith(25)
    })

    it("reads the newest billing events, bounded at 25", async () => {
        const { service, billingEvents } = await build()
        billingEvents.latest.mockResolvedValue([{ id: "b-1", workspaceId: null, kind: "paid", createdAt: AT }])

        await expect(service.recentBillingEvents()).resolves.toEqual([
            { id: "b-1", workspace_id: null, kind: "paid", created_at: ISO },
        ])
        expect(billingEvents.latest).toHaveBeenCalledWith(25)
    })
})

describe("AdminDirectoryReadsService database functions", () => {
    it("reads the counts of every workspace and keeps the rows of one for its activity", async () => {
        const em = mockEntityManager({
            query: [
                WORKSPACE_STATS,
                [
                    {
                        workspace_id: "ws-0",
                        members: 1,
                        last_customer_message_at: null,
                        messages_7d: 0,
                        open_decisions: 0,
                    },
                    {
                        workspace_id: "ws-1",
                        members: 3,
                        last_customer_message_at: "2026-10-12",
                        messages_7d: 4,
                        open_decisions: 1,
                    },
                ],
            ],
        })
        const { service } = await build(em)

        await expect(service.workspaceStats()).resolves.toHaveLength(2)
        await expect(service.workspaceActivity("ws-1")).resolves.toEqual({
            messages_7d: 4,
            last_customer_message_at: "2026-10-12",
            open_decisions: 1,
        })
        await expect(service.workspaceActivity("ws-9")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(WORKSPACE_STATS, [])
    })

    it("reads the Auth emails of the given accounts", async () => {
        const em = mockEntityManager({ query: [USER_EMAILS, [{ id: "u-1", email: "a@b.c" }]] })
        const { service } = await build(em)

        await expect(service.userEmails(["u-1"])).resolves.toEqual([{ id: "u-1", email: "a@b.c" }])
        expect(em.query).toHaveBeenCalledWith(USER_EMAILS, [["u-1"]])
    })
})

describe("AdminDirectoryReadsService database functions: quota and sign-ups", () => {
    it("reads this month's quota of a workspace and none when the function answers nothing", async () => {
        const em = mockEntityManager({
            query: [[QUOTA_STATUS, [{ credits_used: "1", credits_limit: "2", cost_usd: "0.1", period_start: "x" }]]],
        })
        const { service } = await build(em)

        await expect(service.quotaStatus("ws-1")).resolves.toEqual({
            credits_used: "1",
            credits_limit: "2",
            cost_usd: "0.1",
        })
        expect(em.query).toHaveBeenCalledWith(QUOTA_STATUS, ["ws-1"])
    })

    it("answers nothing when the quota function answers no row", async () => {
        const em = mockEntityManager({ query: [QUOTA_STATUS, []] })
        const { service } = await build(em)

        await expect(service.quotaStatus("ws-1")).resolves.toBeUndefined()
    })

    it("reads the sign-ups of the last 14 days as calendar day text", async () => {
        const em = mockEntityManager({
            query: [
                SIGNUPS,
                [
                    { day: new Date(2026, 9, 11), signups: 3 },
                    { day: "2026-10-12", signups: 1 },
                ],
            ],
        })
        const { service } = await build(em)

        await expect(service.signups()).resolves.toEqual([
            { day: "2026-10-11", signups: 3 },
            { day: "2026-10-12", signups: 1 },
        ])
        expect(em.query).toHaveBeenCalledWith(SIGNUPS, [14])
    })
})

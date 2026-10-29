import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AiQuotaOverridesAdminReadService } from "@modules/domain/ai-quota-overrides"
import { AppErrorsReadService } from "@modules/domain/app-errors"
import { BillingEventsReadService } from "@modules/domain/billing"
import { ConnectionsAdminReadService } from "@modules/domain/connections"
import { KnowledgeSourcesAdminReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsAdminReadService } from "@modules/domain/module-context-versions"
import { ModuleInstallationsAdminReadService } from "@modules/domain/module-installations"
import { AgentSyncAdminReadService } from "@modules/domain/openclaw-agent-sync"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { SepayTransactionsAdminReadService } from "@modules/domain/sepay-transactions"
import { MemberRosterService } from "@modules/domain/workspace-members"
import { WorkspaceInvitesAdminReadService } from "@modules/domain/workspace-invites"
import { WorkspaceAdminReadService } from "@modules/domain/workspaces"
import type { WorkspaceAdminRow } from "@modules/domain/workspaces"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type * as R from "./platform-admin-facts.contracts"

/** How many per-workspace count rows the list reads. */
const STATS_LIMIT = 1000
/** How many Auth email rows one read answers. */
const EMAIL_LIMIT = 5000
/** The database functions the console reads: counts, quota, sign-ups and Auth emails are owned by the database. */
const WORKSPACE_STATS = "public.admin_workspace_stats"
const QUOTA_STATUS = "public.ai_quota_status"
const SIGNUPS_PER_DAY = "public.admin_signups_per_day"
const USER_EMAILS = "be_access.user_emails"
/** How many days of sign-ups the health view shows. */
const SIGNUP_DAYS = 14
/** How many payment orders the workspace detail lists. */
const ORDER_LIMIT = 30

/** A calendar day as the database renders it (YYYY-MM-DD); the driver hands a date column over as a local-midnight Date. */
const dayText = (day: Date | string): string => {
    if (typeof day === "string") return day
    const month = String(day.getMonth() + 1).padStart(2, "0")
    const date = String(day.getDate()).padStart(2, "0")
    return `${String(day.getFullYear())}-${month}-${date}`
}

/** An instant as the ISO text the facts carry. */
const at = (instant: Date): string => instant.toISOString()

/** An instant that may be missing as ISO text. */
const atOrNull = (instant: Date | null): string | null => (instant === null ? null : at(instant))

/** A workspace row as the facts the console lists. */
const workspaceFacts = (row: WorkspaceAdminRow): R.WorkspaceFacts => ({
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    status: row.status,
    plan_code: row.planCode,
    paid_until: atOrNull(row.paidUntil),
    created_at: at(row.createdAt),
})

@Injectable()
/**
 * The console's reads, each bounded as the former statement was. Every table belongs to a capability and is read through its
 * read service; the activity counts, quota, sign-ups and Auth emails come from database functions the database owns.
 */
export class AdminDirectoryReadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly workspaceReads: WorkspaceAdminReadService,
        private readonly installations: ModuleInstallationsAdminReadService,
        private readonly connectionReads: ConnectionsAdminReadService,
        private readonly appErrors: AppErrorsReadService,
        private readonly roster: MemberRosterService,
        private readonly invites: WorkspaceInvitesAdminReadService,
        private readonly paymentOrders: PaymentOrdersService,
        private readonly billingEventReads: BillingEventsReadService,
        private readonly contextVersionReads: ContextVersionsAdminReadService,
        private readonly agentSyncReads: AgentSyncAdminReadService,
        private readonly knowledge: KnowledgeSourcesAdminReadService,
        private readonly transferReads: SepayTransactionsAdminReadService,
        private readonly quotaOverrides: AiQuotaOverridesAdminReadService,
    ) {}

    /** The newest customer workspaces. */
    async workspaces(): Promise<Array<R.WorkspaceFacts>> {
        const rows = await this.workspaceReads.newest(1000)
        return rows.map((row) => workspaceFacts(row))
    }

    /** One workspace, or undefined when it does not exist. */
    async workspace(id: string): Promise<R.WorkspaceFacts | undefined> {
        const row = await this.workspaceReads.find(id)
        return row === undefined ? undefined : workspaceFacts(row)
    }

    /** The per-workspace counts the list needs (one row per workspace). */
    workspaceStats(): Promise<Array<R.StatsFacts>> {
        return callDbFunction<R.StatsFacts>(this.entityManager, WORKSPACE_STATS, []).then((rows) =>
            rows.slice(0, STATS_LIMIT),
        )
    }

    /** The agent installations of every workspace. */
    async moduleInstalls(): Promise<Array<R.ModuleBadgeFacts>> {
        const rows = await this.installations.badges(5000)
        return rows.map((row) => ({
            workspace_id: row.workspaceId,
            module_key: row.moduleKey,
            status: row.status,
            live_enabled: row.liveEnabled,
        }))
    }

    /** Every connection that is not disconnected. */
    async liveConnections(): Promise<Array<R.ConnectionBadgeFacts>> {
        const rows = await this.connectionReads.live(5000)
        return rows.map((row) => ({
            created_at: at(row.createdAt),
            last_event_at: atOrNull(row.lastEventAt),
            workspace_id: row.workspaceId,
            provider: row.provider,
            status: row.status,
            environment: row.environment,
        }))
    }

    /** The workspaces of the errors captured since an instant. */
    async errorWorkspaces(since: Date): Promise<Array<R.WorkspaceRefFacts>> {
        const workspaces = await this.appErrors.workspacesSince(since, 5000)
        return workspaces.map((workspaceId) => ({ workspace_id: workspaceId }))
    }

    /** The emails of Auth users. */
    userEmails(ids: ReadonlyArray<string>): Promise<Array<R.UserEmailFacts>> {
        return callDbFunction<R.UserEmailFacts>(this.entityManager, USER_EMAILS, [ids]).then((rows) =>
            rows.slice(0, EMAIL_LIMIT).map((row) => ({ id: row.id, email: row.email })),
        )
    }

    /** The members of a workspace, oldest first. */
    async members(workspaceId: string): Promise<Array<R.MemberFacts>> {
        const rows = await this.roster.oldestOf(workspaceId, 500)
        return rows.map((row) => ({
            user_id: row.userId,
            role: row.role,
            display_name: row.displayName,
            status: row.status,
            created_at: at(row.createdAt),
        }))
    }

    /** The pending invitations of a workspace, newest first. */
    async pendingInvites(workspaceId: string): Promise<Array<R.InviteFacts>> {
        const rows = await this.invites.pendingOf(workspaceId, 200)
        return rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            created_at: at(row.createdAt),
            expires_at: at(row.expiresAt),
        }))
    }

    /** The newest payment orders of a workspace. */
    async orders(workspaceId: string): Promise<Array<R.OrderFacts>> {
        const rows = await this.paymentOrders.list(workspaceId)
        return rows.slice(0, ORDER_LIMIT).map((row) => ({
            id: row.id,
            order_code: row.orderCode,
            plan_code: row.planCode,
            amount_vnd: row.amountVnd,
            status: row.status,
            created_at: row.createdAt,
            paid_at: row.paidAt,
        }))
    }

    /** The newest billing events of a workspace. */
    async billingEvents(workspaceId: string): Promise<Array<R.BillingEventFacts>> {
        return (await this.billingEventReads.latestOfWorkspace(workspaceId, 20)).map((row) => ({
            created_at: at(row.createdAt),
            id: row.id,
            kind: row.kind,
        }))
    }

    /** The agent installations of a workspace. */
    async installs(workspaceId: string): Promise<Array<R.InstallFacts>> {
        const rows = await this.installations.ofWorkspace(workspaceId, 50)
        return rows.map((row) => ({
            id: row.id,
            module_key: row.moduleKey,
            status: row.status,
            operating_mode: row.operatingMode,
            live_enabled: row.liveEnabled,
            active_context_version_id: row.activeContextVersionId,
            processor: row.processor,
        }))
    }

    /** The context versions of a workspace. */
    async contextVersions(workspaceId: string): Promise<Array<R.ContextVersionFacts>> {
        const rows = await this.contextVersionReads.ofWorkspace(workspaceId, 500)
        return rows.map((row) => ({ id: row.id, version: row.version, applied_at: at(row.appliedAt) }))
    }

    /** The OpenClaw sync state of a workspace's agents. */
    async agentSync(workspaceId: string): Promise<Array<R.AgentSyncFacts>> {
        const rows = await this.agentSyncReads.ofWorkspace(workspaceId, 50)
        return rows.map((row) => ({
            installation_id: row.installationId,
            agent_id: row.agentId,
            context_version: row.contextVersion,
            checked_at: at(row.checkedAt),
            status: row.status,
            error: row.error,
        }))
    }

    /** The connections of a workspace, oldest first. */
    async connections(workspaceId: string): Promise<Array<R.ConnectionFacts>> {
        const rows = await this.connectionReads.ofWorkspace(workspaceId, 200)
        return rows.map((row) => ({
            created_at: at(row.createdAt),
            last_event_at: atOrNull(row.lastEventAt),
            last_error: row.lastError,
            id: row.id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            environment: row.environment,
        }))
    }

    /** The newest captured errors of a workspace. */
    async workspaceErrors(workspaceId: string): Promise<Array<R.WorkspaceErrorFacts>> {
        const rows = await this.appErrors.latestOfWorkspace(workspaceId, 20)
        return rows.map((row) => ({
            id: row.id,
            scope: row.scope,
            message: row.message,
            created_at: at(row.createdAt),
        }))
    }

    /** The kind and status of a workspace's knowledge sources. */
    knowledgeSources(workspaceId: string): Promise<Array<R.KnowledgeFacts>> {
        return this.knowledge.stagesOf(workspaceId, 5000)
    }

    /** The SePay transfers matched to the given orders, newest first. */
    async transfers(orderIds: ReadonlyArray<string>): Promise<Array<R.TransferFacts>> {
        const rows = await this.transferReads.matchedTo(orderIds, 30)
        return rows.map((row) => ({
            sepay_id: row.sepayId,
            transfer_amount: row.transferAmount,
            content: row.content,
            status: row.status,
            received_at: at(row.receivedAt),
        }))
    }

    /** The activity counts of one workspace. */
    workspaceActivity(workspaceId: string): Promise<R.ActivityFacts | undefined> {
        return callDbFunction<R.StatsFacts>(this.entityManager, WORKSPACE_STATS, []).then((rows) => {
            const own = rows.find((row) => row.workspace_id === workspaceId)
            return own === undefined
                ? undefined
                : {
                      messages_7d: own.messages_7d,
                      last_customer_message_at: own.last_customer_message_at,
                      open_decisions: own.open_decisions,
                  }
        })
    }

    /** This month's quota status of a workspace. */
    quotaStatus(workspaceId: string): Promise<R.QuotaFacts | undefined> {
        return callDbFunction<R.QuotaFacts>(this.entityManager, QUOTA_STATUS, [workspaceId]).then(([quota]) =>
            quota === undefined
                ? undefined
                : { credits_used: quota.credits_used, credits_limit: quota.credits_limit, cost_usd: quota.cost_usd },
        )
    }

    /** The own credit allowance of a workspace. */
    async quotaOverride(workspaceId: string): Promise<R.QuotaOverrideFacts | undefined> {
        const row = await this.quotaOverrides.creditsOf(workspaceId)
        return row === undefined ? undefined : { credits_limit: row.creditsLimit }
    }

    /** The sign-ups of the last 14 days. */
    signups(): Promise<Array<R.SignupFacts>> {
        return callDbFunction<{ day: Date | string; signups: number }>(this.entityManager, SIGNUPS_PER_DAY, [
            SIGNUP_DAYS,
        ]).then((rows) => rows.slice(0, SIGNUP_DAYS).map((row) => ({ day: dayText(row.day), signups: row.signups })))
    }

    /** The newest SePay transfers. */
    async recentTransfers(): Promise<Array<R.RecentTransferFacts>> {
        const rows = await this.transferReads.latest(25)
        return rows.map((row) => ({
            status: row.status,
            transfer_amount: row.transferAmount,
            content: row.content,
            received_at: at(row.receivedAt),
        }))
    }

    /** The newest billing events. */
    async recentBillingEvents(): Promise<Array<R.RecentBillingEventFacts>> {
        const rows = await this.billingEventReads.latest(25)
        return rows.map((row) => ({
            id: row.id,
            workspace_id: row.workspaceId,
            kind: row.kind,
            created_at: at(row.createdAt),
        }))
    }

    /** The newest captured errors. */
    async recentErrors(): Promise<Array<R.RecentErrorFacts>> {
        const rows = await this.appErrors.latest(50)
        return rows.map((row) => ({
            id: row.id,
            scope: row.scope,
            message: row.message,
            workspace_id: row.workspaceId,
            created_at: at(row.createdAt),
        }))
    }

    /** The errors captured since an instant, counted by scope. */
    async errorScopes(since: Date): Promise<Array<R.CountFacts>> {
        const rows = await this.appErrors.scopesSince(since, 100)
        return rows.map((row) => ({ key: row.scope, count: row.count }))
    }

    /** The names of workspaces. */
    workspaceNames(ids: ReadonlyArray<string>): Promise<Array<R.WorkspaceNameFacts>> {
        return this.workspaceReads.namesOf(ids, 500)
    }
}

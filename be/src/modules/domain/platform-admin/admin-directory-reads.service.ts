import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type * as R from "./platform-admin.facts"
/** A read of one table, the start of every console list. */
type Read = SelectQueryBuilder<object>

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

/** A calendar day as the database renders it (YYYY-MM-DD); the driver hands a date column over as a local-midnight Date. */
const dayText = (day: Date | string): string => {
    if (typeof day === "string") return day
    const month = String(day.getMonth() + 1).padStart(2, "0")
    const date = String(day.getDate()).padStart(2, "0")
    return `${String(day.getFullYear())}-${month}-${date}`
}

/** The columns of a workspace the console lists. */
const WORKSPACE_COLUMNS = ["id", "owner_id", "name", "status", "plan_code", "paid_until", "created_at"] as const

@Injectable()
/**
 * The console's reads, each bounded as the former statement was. The workspaces, installations, connections, orders and
 * errors are table reads; the activity counts, quota, sign-ups and Auth emails come from database functions the database owns.
 */
export class AdminDirectoryReadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest customer workspaces. */
    workspaces(): Promise<Array<R.WorkspaceFacts>> {
        return this.workspaceColumns(this.of("public.workspaces", "w"))
            .orderBy("w.created_at", "DESC")
            .limit(1000)
            .getRawMany<R.WorkspaceFacts>()
    }

    /** One workspace, or undefined when it does not exist. */
    workspace(id: string): Promise<R.WorkspaceFacts | undefined> {
        return this.workspaceColumns(this.of("public.workspaces", "w"))
            .where("w.id = :id", { id })
            .limit(1)
            .getRawOne<R.WorkspaceFacts>()
    }

    /** The per-workspace counts the list needs (one row per workspace). */
    workspaceStats(): Promise<Array<R.StatsFacts>> {
        return callDbFunction<R.StatsFacts>(this.entityManager, WORKSPACE_STATS, []).then((rows) =>
            rows.slice(0, STATS_LIMIT),
        )
    }

    /** The agent installations of every workspace. */
    moduleInstalls(): Promise<Array<R.ModuleBadgeFacts>> {
        return this.of("public.module_installations", "i")
            .select("i.workspace_id", "workspace_id")
            .addSelect("i.module_key", "module_key")
            .addSelect("i.status", "status")
            .addSelect("i.live_enabled", "live_enabled")
            .limit(5000)
            .getRawMany<R.ModuleBadgeFacts>()
    }

    /** Every connection that is not disconnected. */
    liveConnections(): Promise<Array<R.ConnectionBadgeFacts>> {
        return this.of("public.connections", "c")
            .select("c.workspace_id", "workspace_id")
            .addSelect("c.provider", "provider")
            .addSelect("c.status", "status")
            .addSelect("c.environment", "environment")
            .addSelect("c.last_event_at", "last_event_at")
            .addSelect("c.created_at", "created_at")
            .where("c.status <> 'disconnected'")
            .limit(5000)
            .getRawMany<R.ConnectionBadgeFacts>()
    }

    /** The workspaces of the errors captured since an instant. */
    errorWorkspaces(since: Date): Promise<Array<R.WorkspaceRefFacts>> {
        return this.of("public.app_errors", "e")
            .select("e.workspace_id", "workspace_id")
            .where("e.created_at >= :since AND e.workspace_id IS NOT NULL", { since })
            .limit(5000)
            .getRawMany<R.WorkspaceRefFacts>()
    }

    /** The emails of Auth users. */
    userEmails(ids: ReadonlyArray<string>): Promise<Array<R.UserEmailFacts>> {
        return callDbFunction<R.UserEmailFacts>(this.entityManager, USER_EMAILS, [ids]).then((rows) =>
            rows.slice(0, EMAIL_LIMIT).map((row) => ({ id: row.id, email: row.email })),
        )
    }

    /** The members of a workspace, oldest first. */
    members(workspaceId: string): Promise<Array<R.MemberFacts>> {
        return this.ofWorkspace("public.workspace_members", "m", workspaceId)
            .select("m.user_id", "user_id")
            .addSelect("m.role", "role")
            .addSelect("m.display_name", "display_name")
            .addSelect("m.status", "status")
            .addSelect("m.created_at", "created_at")
            .orderBy("m.created_at")
            .limit(500)
            .getRawMany<R.MemberFacts>()
    }

    /** The pending invitations of a workspace, newest first. */
    pendingInvites(workspaceId: string): Promise<Array<R.InviteFacts>> {
        return this.ofWorkspace("public.workspace_invites", "v", workspaceId)
            .select("v.id", "id")
            .addSelect("v.email", "email")
            .addSelect("v.role", "role")
            .addSelect("v.created_at", "created_at")
            .addSelect("v.expires_at", "expires_at")
            .andWhere("v.accepted_at IS NULL AND v.revoked_at IS NULL")
            .orderBy("v.created_at", "DESC")
            .limit(200)
            .getRawMany<R.InviteFacts>()
    }

    /** The newest payment orders of a workspace. */
    orders(workspaceId: string): Promise<Array<R.OrderFacts>> {
        return this.ofWorkspace("public.payment_orders", "o", workspaceId)
            .select("o.id", "id")
            .addSelect("o.order_code", "order_code")
            .addSelect("o.plan_code", "plan_code")
            .addSelect("o.amount_vnd", "amount_vnd")
            .addSelect("o.status", "status")
            .addSelect("o.created_at", "created_at")
            .addSelect("o.paid_at", "paid_at")
            .orderBy("o.created_at", "DESC")
            .limit(30)
            .getRawMany<R.OrderFacts>()
    }

    /** The newest billing events of a workspace. */
    billingEvents(workspaceId: string): Promise<Array<R.BillingEventFacts>> {
        return this.ofWorkspace("public.billing_events", "b", workspaceId)
            .select("b.id", "id")
            .addSelect("b.kind", "kind")
            .addSelect("b.created_at", "created_at")
            .orderBy("b.created_at", "DESC")
            .limit(20)
            .getRawMany<R.BillingEventFacts>()
    }

    /** The agent installations of a workspace. */
    installs(workspaceId: string): Promise<Array<R.InstallFacts>> {
        return this.ofWorkspace("public.module_installations", "i", workspaceId)
            .select("i.id", "id")
            .addSelect("i.module_key", "module_key")
            .addSelect("i.status", "status")
            .addSelect("i.operating_mode", "operating_mode")
            .addSelect("i.live_enabled", "live_enabled")
            .addSelect("i.active_context_version_id", "active_context_version_id")
            .addSelect("i.settings ->> 'processor'", "processor")
            .limit(50)
            .getRawMany<R.InstallFacts>()
    }

    /** The context versions of a workspace. */
    contextVersions(workspaceId: string): Promise<Array<R.ContextVersionFacts>> {
        return this.ofWorkspace("public.module_context_versions", "v", workspaceId)
            .select("v.id", "id")
            .addSelect("v.version", "version")
            .addSelect("v.applied_at", "applied_at")
            .limit(500)
            .getRawMany<R.ContextVersionFacts>()
    }

    /** The OpenClaw sync state of a workspace's agents. */
    agentSync(workspaceId: string): Promise<Array<R.AgentSyncFacts>> {
        return this.ofWorkspace("public.openclaw_agent_sync", "s", workspaceId)
            .select("s.installation_id", "installation_id")
            .addSelect("s.agent_id", "agent_id")
            .addSelect("s.context_version", "context_version")
            .addSelect("s.checked_at", "checked_at")
            .addSelect("s.status", "status")
            .addSelect("s.error", "error")
            .limit(50)
            .getRawMany<R.AgentSyncFacts>()
    }

    /** The connections of a workspace, oldest first. */
    connections(workspaceId: string): Promise<Array<R.ConnectionFacts>> {
        return this.ofWorkspace("public.connections", "c", workspaceId)
            .select("c.id", "id")
            .addSelect("c.provider", "provider")
            .addSelect("c.name", "name")
            .addSelect("c.status", "status")
            .addSelect("c.environment", "environment")
            .addSelect("c.last_event_at", "last_event_at")
            .addSelect("c.last_error", "last_error")
            .addSelect("c.created_at", "created_at")
            .orderBy("c.created_at")
            .limit(200)
            .getRawMany<R.ConnectionFacts>()
    }

    /** The newest captured errors of a workspace. */
    workspaceErrors(workspaceId: string): Promise<Array<R.WorkspaceErrorFacts>> {
        return this.ofWorkspace("public.app_errors", "e", workspaceId)
            .select("e.id", "id")
            .addSelect("e.scope", "scope")
            .addSelect("e.message", "message")
            .addSelect("e.created_at", "created_at")
            .orderBy("e.created_at", "DESC")
            .limit(20)
            .getRawMany<R.WorkspaceErrorFacts>()
    }

    /** The kind and status of a workspace's knowledge sources. */
    knowledgeSources(workspaceId: string): Promise<Array<R.KnowledgeFacts>> {
        return this.ofWorkspace("public.knowledge_sources", "k", workspaceId)
            .select("k.kind", "kind")
            .addSelect("k.status", "status")
            .limit(5000)
            .getRawMany<R.KnowledgeFacts>()
    }

    /** The SePay transfers matched to the given orders, newest first. */
    async transfers(orderIds: ReadonlyArray<string>): Promise<Array<R.TransferFacts>> {
        if (orderIds.length === 0) return []
        return this.of("public.sepay_transactions", "t")
            .select("t.sepay_id", "sepay_id")
            .addSelect("t.transfer_amount", "transfer_amount")
            .addSelect("t.content", "content")
            .addSelect("t.status", "status")
            .addSelect("t.received_at", "received_at")
            .where("t.matched_order_id IN (:...orderIds)", { orderIds })
            .orderBy("t.received_at", "DESC")
            .limit(30)
            .getRawMany<R.TransferFacts>()
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
    quotaOverride(workspaceId: string): Promise<R.QuotaOverrideFacts | undefined> {
        return this.ofWorkspace("public.ai_quota_overrides", "q", workspaceId)
            .select("q.credits_limit", "credits_limit")
            .limit(1)
            .getRawOne<R.QuotaOverrideFacts>()
    }

    /** The sign-ups of the last 14 days. */
    signups(): Promise<Array<R.SignupFacts>> {
        return callDbFunction<{ day: Date | string; signups: number }>(this.entityManager, SIGNUPS_PER_DAY, [
            SIGNUP_DAYS,
        ]).then((rows) => rows.slice(0, SIGNUP_DAYS).map((row) => ({ day: dayText(row.day), signups: row.signups })))
    }

    /** The newest SePay transfers. */
    recentTransfers(): Promise<Array<R.RecentTransferFacts>> {
        return this.of("public.sepay_transactions", "t")
            .select("t.status", "status")
            .addSelect("t.transfer_amount", "transfer_amount")
            .addSelect("t.content", "content")
            .addSelect("t.received_at", "received_at")
            .orderBy("t.received_at", "DESC")
            .limit(25)
            .getRawMany<R.RecentTransferFacts>()
    }

    /** The newest billing events. */
    recentBillingEvents(): Promise<Array<R.RecentBillingEventFacts>> {
        return this.of("public.billing_events", "b")
            .select("b.id", "id")
            .addSelect("b.workspace_id", "workspace_id")
            .addSelect("b.kind", "kind")
            .addSelect("b.created_at", "created_at")
            .orderBy("b.created_at", "DESC")
            .limit(25)
            .getRawMany<R.RecentBillingEventFacts>()
    }

    /** The newest captured errors. */
    recentErrors(): Promise<Array<R.RecentErrorFacts>> {
        return this.of("public.app_errors", "e")
            .select("e.id", "id")
            .addSelect("e.scope", "scope")
            .addSelect("e.message", "message")
            .addSelect("e.workspace_id", "workspace_id")
            .addSelect("e.created_at", "created_at")
            .orderBy("e.created_at", "DESC")
            .limit(50)
            .getRawMany<R.RecentErrorFacts>()
    }

    /** The errors captured since an instant, counted by scope. */
    errorScopes(since: Date): Promise<Array<R.CountFacts>> {
        return this.of("public.app_errors", "e")
            .select("e.scope", "key")
            .addSelect("(count(*))::int", "count")
            .where("e.created_at >= :since", { since })
            .groupBy("e.scope")
            .orderBy("count", "DESC")
            .addOrderBy("e.scope")
            .limit(100)
            .getRawMany<R.CountFacts>()
    }

    /** The names of workspaces. */
    async workspaceNames(ids: ReadonlyArray<string>): Promise<Array<R.WorkspaceNameFacts>> {
        if (ids.length === 0) return []
        return this.of("public.workspaces", "w")
            .select("w.id", "id")
            .addSelect("w.name", "name")
            .where("w.id IN (:...ids)", { ids })
            .limit(500)
            .getRawMany<R.WorkspaceNameFacts>()
    }

    /** A read of one table. */
    private of(table: string, alias: string): Read {
        return this.entityManager.createQueryBuilder().from(table, alias)
    }

    /** A read of one table scoped to a workspace. */
    private ofWorkspace(table: string, alias: string, workspaceId: string): Read {
        return this.of(table, alias).where(`${alias}.workspace_id = :workspaceId`, { workspaceId })
    }

    /** Selects the workspace columns of the console lists. */
    private workspaceColumns(read: Read): Read {
        return WORKSPACE_COLUMNS.reduce(
            (selected, column, index) =>
                index === 0 ? selected.select(`w.${column}`, column) : selected.addSelect(`w.${column}`, column),
            read,
        )
    }
}

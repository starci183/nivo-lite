import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { AdminAccessService } from "./admin-access.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"
import {
    FIND_QUOTA_OVERRIDE,
    FIND_QUOTA_STATUS,
    FIND_WORKSPACE,
    FIND_WORKSPACE_STATS,
    LIST_AGENT_SYNC,
    LIST_BILLING_EVENTS,
    LIST_CONNECTIONS,
    LIST_CONTEXT_VERSIONS,
    LIST_ERROR_SCOPES,
    LIST_ERROR_WORKSPACES,
    LIST_INSTALLS,
    LIST_KNOWLEDGE_SOURCES,
    LIST_LIVE_CONNECTIONS,
    LIST_MEMBERS,
    LIST_MODULE_INSTALLS,
    LIST_ORDERS,
    LIST_PENDING_INVITES,
    LIST_RECENT_BILLING_EVENTS,
    LIST_RECENT_ERRORS,
    LIST_RECENT_TRANSFERS,
    LIST_SIGNUPS,
    LIST_TRANSFERS,
    LIST_USER_EMAILS,
    LIST_WORKSPACES,
    LIST_WORKSPACE_ERRORS,
    LIST_WORKSPACE_NAMES,
    LIST_WORKSPACE_STATS,
} from "./persistence/platform-admin.sql"
import type * as R from "./persistence/platform-admin.rows"
import type {
    AdminHealth,
    AdminIdentity,
    AdminModule,
    AdminWorkspaceDetail,
    AdminWorkspaceItem,
    AdminWorkspaceList,
    WorkspaceListQuery,
} from "./platform-admin.contracts"
import {
    toBillingEvent,
    toConnection,
    toError,
    toInvite,
    toMember,
    toOrder,
    toPlatformBillingEvent,
    toPlatformError,
    toPlatformTransfer,
    toSignupDay,
    toTransfer,
    iso,
    isoOrNull,
} from "./platform-admin.mapper"
import {
    countByWorkspace,
    creditsFrom,
    filterCounts,
    knowledgeByKind,
    matchesWorkspace,
    summarizeConnections,
    tally,
    workspaceFlags,
} from "./platform-admin.policy"

const DAY_MS = 86_400_000

@Injectable()
/** The console's read side: the workspace list, one workspace's overview and the platform health; every view is audited. */
export class AdminDirectoryService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly access: AdminAccessService,
        private readonly audits: PlatformAuditService,
    ) {}

    /** The platform admin behind the request, for the console's chrome. */
    session(principal: Principal): Promise<AdminIdentity> {
        return Promise.resolve().then(() => this.access.requireAdmin(principal))
    }

    /** Every customer workspace with billing, agents, connections and activity, filtered and searched. */
    async listWorkspaces(principal: Principal, query: WorkspaceListQuery): Promise<AdminWorkspaceList> {
        const admin = this.access.requireAdmin(principal)
        await this.access.audit(admin, "view.workspaces", null, { filter: query.filter, q: query.query })
        const nowMs = this.clock.now().getTime()
        const since = new Date(nowMs - DAY_MS)
        const em = this.entityManager
        const [workspaces, stats, installs, connections, errors] = await Promise.all([
            em.query<Array<R.WorkspaceRow>>(LIST_WORKSPACES),
            em.query<Array<R.StatsRow>>(LIST_WORKSPACE_STATS),
            em.query<Array<R.ModuleBadgeRow>>(LIST_MODULE_INSTALLS),
            em.query<Array<R.ConnectionBadgeRow>>(LIST_LIVE_CONNECTIONS),
            em.query<Array<R.WorkspaceRefRow>>(LIST_ERROR_WORKSPACES, [since]),
        ])
        const owners = await this.emailsOf(workspaces.map((workspace) => workspace.owner_id))
        const statsBy = new Map(stats.map((row) => [row.workspace_id, row]))
        const errorsBy = countByWorkspace(errors)
        const items = workspaces.map((workspace): AdminWorkspaceItem => {
            const own = statsBy.get(workspace.id)
            const badges = summarizeConnections(
                connections
                    .filter((connection) => connection.workspace_id === workspace.id)
                    .map((connection) => ({
                        provider: connection.provider,
                        status: connection.status,
                        environment: connection.environment,
                        lastEventAt: connection.last_event_at,
                        createdAt: connection.created_at,
                    })),
                nowMs,
            )
            const connectionWarning = badges.some((badge) => badge.error + badge.silent > 0)
            const errors24h = errorsBy.get(workspace.id) ?? 0
            const messages7d = own?.messages_7d ?? 0
            const paidUntil = isoOrNull(workspace.paid_until)
            return {
                id: workspace.id,
                name: workspace.name,
                ownerEmail: owners.get(workspace.owner_id) ?? null,
                status: workspace.status,
                planCode: workspace.plan_code,
                paidUntil,
                createdAt: iso(workspace.created_at),
                members: own?.members ?? 0,
                modules: installs
                    .filter((install) => install.workspace_id === workspace.id)
                    .map((install) => ({
                        key: install.module_key,
                        status: install.status,
                        live: install.live_enabled,
                    })),
                connections: badges,
                connectionWarning,
                lastCustomerMessageAt: isoOrNull(own?.last_customer_message_at ?? null),
                messages7d,
                openDecisions: own?.open_decisions ?? 0,
                errors24h,
                ...workspaceFlags(
                    { status: workspace.status, paidUntil, connectionWarning, errors24h, messages7d },
                    nowMs,
                ),
            }
        })
        return {
            total: items.length,
            counts: filterCounts(items),
            items: items.filter((item) => matchesWorkspace(item, query.filter, query.query)),
        }
    }

    /** The read-only overview of one workspace. */
    async workspaceDetail(principal: Principal, workspaceId: string): Promise<AdminWorkspaceDetail> {
        const admin = this.access.requireAdmin(principal)
        const em = this.entityManager
        const nowMs = this.clock.now().getTime()
        const [workspace] = await em.query<Array<R.WorkspaceRow>>(FIND_WORKSPACE, [workspaceId])
        if (workspace === undefined) throw new PlatformAdminError({ code: PlatformAdminErrorCode.WorkspaceNotFound })
        const [members, invites, orders, billingEvents, installs, versions, syncs] = await Promise.all([
            em.query<Array<R.MemberRow>>(LIST_MEMBERS, [workspaceId]),
            em.query<Array<R.InviteRow>>(LIST_PENDING_INVITES, [workspaceId]),
            em.query<Array<R.OrderRow>>(LIST_ORDERS, [workspaceId]),
            em.query<Array<R.BillingEventRow>>(LIST_BILLING_EVENTS, [workspaceId]),
            em.query<Array<R.InstallRow>>(LIST_INSTALLS, [workspaceId]),
            em.query<Array<R.ContextVersionRow>>(LIST_CONTEXT_VERSIONS, [workspaceId]),
            em.query<Array<R.AgentSyncRow>>(LIST_AGENT_SYNC, [workspaceId]),
        ])
        const [connections, errors, sources, statsRows, quotaRows, overrideRows] = await Promise.all([
            em.query<Array<R.ConnectionRow>>(LIST_CONNECTIONS, [workspaceId]),
            em.query<Array<R.WorkspaceErrorRow>>(LIST_WORKSPACE_ERRORS, [workspaceId]),
            em.query<Array<R.KnowledgeRow>>(LIST_KNOWLEDGE_SOURCES, [workspaceId]),
            em.query<Array<R.ActivityRow>>(FIND_WORKSPACE_STATS, [workspaceId]),
            em.query<Array<R.QuotaRow>>(FIND_QUOTA_STATUS, [workspaceId]),
            em.query<Array<R.QuotaOverrideRow>>(FIND_QUOTA_OVERRIDE, [workspaceId]),
        ])
        const [stats] = statsRows
        const transfers =
            orders.length === 0
                ? []
                : await em.query<Array<R.TransferRow>>(LIST_TRANSFERS, [orders.map((order) => order.id)])
        const emails = await this.emailsOf([workspace.owner_id, ...members.map((member) => member.user_id)])
        await this.access.audit(admin, "view.workspace", workspaceId)
        return {
            workspace: {
                id: workspace.id,
                name: workspace.name,
                ownerEmail: emails.get(workspace.owner_id) ?? null,
                status: workspace.status,
                planCode: workspace.plan_code,
                paidUntil: isoOrNull(workspace.paid_until),
                createdAt: iso(workspace.created_at),
            },
            credits: creditsFrom(quotaRows[0], overrideRows[0]),
            members: members.map((member) => toMember(member, emails.get(member.user_id) ?? null)),
            invites: invites.map(toInvite),
            orders: orders.map(toOrder),
            transfers: transfers.map(toTransfer),
            billingEvents: billingEvents.map(toBillingEvent),
            modules: installs.map((install): AdminModule => {
                const version = versions.find((candidate) => candidate.id === install.active_context_version_id)
                const sync = syncs.find((candidate) => candidate.installation_id === install.id)
                return {
                    id: install.id,
                    key: install.module_key,
                    status: install.status,
                    operatingMode: install.operating_mode,
                    live: install.live_enabled,
                    processor: install.processor === "openclaw" ? "openclaw" : "nivo",
                    contextVersion: version?.version ?? null,
                    contextAppliedAt: isoOrNull(version?.applied_at ?? null),
                    sync:
                        sync === undefined
                            ? null
                            : {
                                  agentId: sync.agent_id,
                                  contextVersion: sync.context_version,
                                  checkedAt: iso(sync.checked_at),
                                  status: sync.status,
                                  error: sync.error,
                              },
                }
            }),
            connections: connections.map((connection) => toConnection(connection, nowMs)),
            errors: errors.map(toError),
            knowledgeTotal: sources.length,
            knowledge: knowledgeByKind(sources),
            activity: {
                messages7d: stats?.messages_7d ?? 0,
                lastCustomerMessageAt: isoOrNull(stats?.last_customer_message_at ?? null),
                openDecisions: stats?.open_decisions ?? 0,
            },
        }
    }

    /** Sign-ups, billing events, application errors and the latest audit rows. */
    async health(principal: Principal): Promise<AdminHealth> {
        const admin = this.access.requireAdmin(principal)
        await this.access.audit(admin, "view.health", null)
        const em = this.entityManager
        const since = new Date(this.clock.now().getTime() - DAY_MS)
        const [signups, transfers, billingEvents, errors, scopes, audits] = await Promise.all([
            em.query<Array<R.SignupRow>>(LIST_SIGNUPS),
            em.query<Array<R.RecentTransferRow>>(LIST_RECENT_TRANSFERS),
            em.query<Array<R.RecentBillingEventRow>>(LIST_RECENT_BILLING_EVENTS),
            em.query<Array<R.RecentErrorRow>>(LIST_RECENT_ERRORS),
            em.query<Array<R.CountRow>>(LIST_ERROR_SCOPES, [since]),
            this.audits.recent(),
        ])
        const referenced = [
            ...new Set(
                [
                    ...[...errors, ...billingEvents].map((row) => row.workspace_id),
                    ...audits.map((audit) => audit.workspaceId),
                ].filter((id): id is string => id !== null),
            ),
        ]
        const names =
            referenced.length === 0 ? [] : await em.query<Array<R.WorkspaceNameRow>>(LIST_WORKSPACE_NAMES, [referenced])
        return {
            signups: signups.map(toSignupDay),
            transfers: transfers.map(toPlatformTransfer),
            transferCounts: tally(transfers.map((transfer) => transfer.status)),
            billingEvents: billingEvents.map(toPlatformBillingEvent),
            errors: errors.map(toPlatformError),
            errorScopes: scopes,
            audits,
            workspaceNames: names,
        }
    }

    private async emailsOf(ids: ReadonlyArray<string>): Promise<Map<string, string>> {
        const unique = [...new Set(ids)]
        if (unique.length === 0) return new Map()
        const rows = await this.entityManager.query<Array<R.UserEmailRow>>(LIST_USER_EMAILS, [unique])
        return new Map(rows.map((row) => [row.id, row.email]))
    }
}

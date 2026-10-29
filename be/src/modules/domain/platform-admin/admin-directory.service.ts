import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { AdminAccessService } from "./admin-access.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"
import { AdminDirectoryReadsService } from "./admin-directory-reads.service"
import type * as R from "./platform-admin-facts.contracts"
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
/**
 * The console's read side: the workspace list, one workspace's overview and the platform health; every view is audited.
 */
export class AdminDirectoryService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly access: AdminAccessService,
        private readonly audits: PlatformAuditService,
        private readonly reads: AdminDirectoryReadsService,
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
        const [workspaces, stats, installs, connections, errors] = await Promise.all([
            this.reads.workspaces(),
            this.reads.workspaceStats(),
            this.reads.moduleInstalls(),
            this.reads.liveConnections(),
            this.reads.errorWorkspaces(since),
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
        const nowMs = this.clock.now().getTime()
        const workspace = await this.reads.workspace(workspaceId)
        if (workspace === undefined) throw new PlatformAdminError({ code: PlatformAdminErrorCode.WorkspaceNotFound })
        const [members, invites, orders, billingEvents, installs, versions, syncs] = await Promise.all([
            this.reads.members(workspaceId),
            this.reads.pendingInvites(workspaceId),
            this.reads.orders(workspaceId),
            this.reads.billingEvents(workspaceId),
            this.reads.installs(workspaceId),
            this.reads.contextVersions(workspaceId),
            this.reads.agentSync(workspaceId),
        ])
        const [connections, errors, sources, stats, quota, override] = await Promise.all([
            this.reads.connections(workspaceId),
            this.reads.workspaceErrors(workspaceId),
            this.reads.knowledgeSources(workspaceId),
            this.reads.workspaceActivity(workspaceId),
            this.reads.quotaStatus(workspaceId),
            this.reads.quotaOverride(workspaceId),
        ])
        const transfers = orders.length === 0 ? [] : await this.reads.transfers(orders.map((order) => order.id))
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
            credits: creditsFrom(quota, override),
            members: members.map((member) => toMember(member, emails.get(member.user_id) ?? null)),
            invites: invites.map(toInvite),
            orders: orders.map(toOrder),
            transfers: transfers.map(toTransfer),
            billingEvents: billingEvents.map(toBillingEvent),
            modules: this.workspaceModules(installs, versions, syncs),
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
        const since = new Date(this.clock.now().getTime() - DAY_MS)
        const [signups, transfers, billingEvents, errors, scopes, audits] = await Promise.all([
            this.reads.signups(),
            this.reads.recentTransfers(),
            this.reads.recentBillingEvents(),
            this.reads.recentErrors(),
            this.reads.errorScopes(since),
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
        const names = referenced.length === 0 ? [] : await this.reads.workspaceNames(referenced)
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
        const rows = await this.reads.userEmails(unique)
        return new Map(rows.map((row) => [row.id, row.email]))
    }

    private workspaceModules(
        installs: ReadonlyArray<R.InstallFacts>,
        versions: ReadonlyArray<R.ContextVersionFacts>,
        syncs: ReadonlyArray<R.AgentSyncFacts>,
    ): Array<AdminModule> {
        return installs.map((install): AdminModule => {
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
        })
    }
}

import type { Database } from "../../../../../../../supabase/types/database.types"
import { connectionHealth, iso, isoOrNull, numberOrNull } from "./admin.mapper"
import type { AdminWorkspaceDetail } from "./admin.mapper"

type Tables = Database["public"]["Tables"]

/** The rows one workspace overview is built from, as the console reads them. */
export interface WorkspaceDetailInput {
    readonly workspace: Pick<
        Tables["workspaces"]["Row"],
        "id" | "owner_id" | "name" | "status" | "plan_code" | "paid_until" | "created_at"
    >
    readonly members: ReadonlyArray<
        Pick<Tables["workspace_members"]["Row"], "user_id" | "role" | "display_name" | "status">
    >
    readonly invites: ReadonlyArray<
        Pick<Tables["workspace_invites"]["Row"], "id" | "email" | "role" | "created_at" | "expires_at">
    >
    readonly orders: ReadonlyArray<
        Pick<
            Tables["payment_orders"]["Row"],
            "id" | "order_code" | "plan_code" | "amount_vnd" | "status" | "created_at" | "paid_at"
        >
    >
    readonly transfers: ReadonlyArray<
        Pick<Tables["sepay_transactions"]["Row"], "sepay_id" | "transfer_amount" | "content" | "status" | "received_at">
    >
    readonly billingEvents: ReadonlyArray<Pick<Tables["billing_events"]["Row"], "id" | "kind" | "created_at">>
    readonly installs: ReadonlyArray<{
        readonly id: string
        readonly module_key: string
        readonly status: string
        readonly operating_mode: string
        readonly live_enabled: boolean
        readonly active_context_version_id: string | null
        readonly settings: unknown
    }>
    readonly versions: ReadonlyArray<Pick<Tables["module_context_versions"]["Row"], "id" | "version" | "applied_at">>
    readonly syncs: ReadonlyArray<
        Pick<
            Tables["openclaw_agent_sync"]["Row"],
            "installation_id" | "agent_id" | "context_version" | "checked_at" | "status" | "error"
        >
    >
    readonly connections: ReadonlyArray<
        Pick<
            Tables["connections"]["Row"],
            "id" | "provider" | "name" | "status" | "environment" | "last_event_at" | "last_error" | "created_at"
        >
    >
    readonly errors: ReadonlyArray<Pick<Tables["app_errors"]["Row"], "id" | "scope" | "message" | "created_at">>
    readonly sources: ReadonlyArray<Pick<Tables["knowledge_sources"]["Row"], "kind" | "status">>
    readonly activity: {
        readonly messages_7d: number
        readonly last_customer_message_at: string | null
        readonly open_decisions: number
    } | null
    readonly quota: {
        readonly credits_used: number | null
        readonly credits_limit: number | null
        readonly cost_usd: number
    } | null
    readonly ownLimit: number | null
    readonly emails: ReadonlyMap<string, string>
    readonly nowMs: number
}

/** The credits per US dollar of model cost. */
const CREDITS_PER_USD = 250

const processorOf = (settings: unknown): "openclaw" | "nivo" =>
    typeof settings === "object" && settings !== null && "processor" in settings && settings.processor === "openclaw"
        ? "openclaw"
        : "nivo"

const knowledgeByKind = (
    rows: ReadonlyArray<{ readonly kind: string; readonly status: string }>,
): AdminWorkspaceDetail["knowledge"] => {
    const kinds = new Map<string, Record<string, number>>()
    for (const row of rows) {
        const byStatus = kinds.get(row.kind) ?? {}
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
        kinds.set(row.kind, byStatus)
    }
    return [...kinds.entries()].map(([kind, byStatus]) => ({ kind, byStatus }))
}

const creditsOf = (input: WorkspaceDetailInput): AdminWorkspaceDetail["credits"] => {
    const quota = input.quota
    const costUsd = quota === null ? 0 : Number(quota.cost_usd)
    const reported = quota === null ? null : numberOrNull(quota.credits_used)
    return {
        used: reported ?? Math.round(costUsd * CREDITS_PER_USD * 100) / 100,
        limit: quota === null ? null : numberOrNull(quota.credits_limit),
        costUsd,
        ownLimit: input.ownLimit,
    }
}

/** Builds the full read-only overview of one workspace. */
export const workspaceDetailOf = (input: WorkspaceDetailInput): AdminWorkspaceDetail => {
    const { workspace, emails, nowMs } = input
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
        credits: creditsOf(input),
        members: input.members.map((member) => ({
            userId: member.user_id,
            role: member.role,
            displayName: member.display_name,
            status: member.status,
            email: emails.get(member.user_id) ?? null,
        })),
        invites: input.invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            createdAt: iso(invite.created_at),
            expiresAt: iso(invite.expires_at),
        })),
        orders: input.orders.map((order) => ({
            id: order.id,
            orderCode: order.order_code,
            planCode: order.plan_code,
            amountVnd: Number(order.amount_vnd),
            status: order.status,
            createdAt: iso(order.created_at),
            paidAt: isoOrNull(order.paid_at),
        })),
        transfers: input.transfers.map((transfer) => ({
            sepayId: Number(transfer.sepay_id),
            transferAmount: numberOrNull(transfer.transfer_amount),
            content: transfer.content,
            status: transfer.status,
            receivedAt: iso(transfer.received_at),
        })),
        billingEvents: input.billingEvents.map((event) => ({
            id: event.id,
            kind: event.kind,
            createdAt: iso(event.created_at),
        })),
        modules: input.installs.map((install) => {
            const version = input.versions.find((candidate) => candidate.id === install.active_context_version_id)
            const sync = input.syncs.find((candidate) => candidate.installation_id === install.id)
            return {
                id: install.id,
                key: install.module_key,
                status: install.status,
                operatingMode: install.operating_mode,
                live: install.live_enabled,
                processor: processorOf(install.settings),
                contextVersion: version?.version ?? null,
                contextAppliedAt: isoOrNull(version?.applied_at),
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
        connections: input.connections.map((connection) => ({
            id: connection.id,
            provider: connection.provider,
            name: connection.name,
            status: connection.status,
            environment: connection.environment ?? "live",
            lastEventAt: isoOrNull(connection.last_event_at),
            lastError: connection.last_error,
            health: connectionHealth(
                {
                    status: connection.status,
                    environment: connection.environment,
                    lastEventAt: connection.last_event_at,
                    createdAt: connection.created_at,
                },
                nowMs,
            ),
        })),
        errors: input.errors.map((error) => ({
            id: error.id,
            scope: error.scope,
            message: error.message,
            createdAt: iso(error.created_at),
        })),
        knowledgeTotal: input.sources.length,
        knowledge: knowledgeByKind(input.sources),
        activity: {
            messages7d: input.activity?.messages_7d ?? 0,
            lastCustomerMessageAt: isoOrNull(input.activity?.last_customer_message_at),
            openDecisions: input.activity?.open_decisions ?? 0,
        },
    }
}

import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { workspaceDetailOf } from "./admin-detail.mapper"
import { healthOf, referencedWorkspaces } from "./admin-health.mapper"
import { workspaceItemsOf, workspaceListOf } from "./admin-workspaces.mapper"
import type {
    AdminHealth,
    AdminSession,
    AdminWorkspaceDetail,
    AdminWorkspaceFilter,
    AdminWorkspaceList,
} from "./admin.mapper"

const DAY_MS = 86_400_000

/** The filter and the free-text search of the workspace list. */
export interface AdminWorkspacesInput {
    readonly filter: AdminWorkspaceFilter
    readonly query: string
}

type Client = Awaited<ReturnType<typeof createServerDbClient>>

/** Whether the caller is platform staff, asked of the database; anyone else is refused so the console is not discoverable. */
const requireAdmin = async (client: Client): Promise<DbOutcome<AdminSession>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const { data, error } = await client.rpc("is_platform_admin")
    if (error !== null) return rpcFailure(error)
    return data ? dbOk({ email: principal.value.email ?? "" }) : dbFailure("refused", "not-platform-admin")
}

/** Writes what the staff member viewed; the trail never fails the read. */
const audit = async (
    client: Client,
    action: string,
    workspaceId: string | null,
    data: Record<string, string> = {},
): Promise<boolean> => {
    const { error } = await client.rpc("admin_console_audit", {
        p_action: action,
        p_data: data,
        ...(workspaceId === null ? {} : { p_workspace: workspaceId }),
    })
    return error === null
}

/** The emails of Auth users the staff may see; unknown ids stay blank rather than failing the page. */
const emailsOf = async (client: Client, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> => {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Map()
    const { data, error } = await client.rpc("admin_console_user_emails", { p_ids: unique })
    return error === null ? new Map(data.map((row) => [row.id, row.email])) : new Map()
}

/** The SePay transfers matched to the orders of a workspace, newest first. */
const transfersOf = async (client: Client, orderIds: ReadonlyArray<string>) =>
    orderIds.length === 0
        ? dbOk([])
        : toOutcome(
              await client
                  .from("sepay_transactions")
                  .select("sepay_id, transfer_amount, content, status, received_at")
                  .in("matched_order_id", [...orderIds])
                  .order("received_at", { ascending: false })
                  .limit(30),
          )

/** The names of the workspaces the health rows mention. */
const namesOf = async (client: Client, ids: ReadonlyArray<string>) =>
    ids.length === 0
        ? dbOk([])
        : toOutcome(
              await client
                  .from("workspaces")
                  .select("id, name")
                  .in("id", [...ids])
                  .limit(500),
          )

/** Asks who the platform admin is; anyone else is refused. */
export const readAdminSession = async (): Promise<DbOutcome<AdminSession>> => requireAdmin(await createServerDbClient())

/** Reads every customer workspace the filter and the search keep, with the size of each filter, under the staff policies. */
export const readAdminWorkspaces = async (input: AdminWorkspacesInput): Promise<DbOutcome<AdminWorkspaceList>> => {
    const client = await createServerDbClient()
    const admin = await requireAdmin(client)
    if (admin.kind !== "ok") return admin
    await audit(client, "view.workspaces", null, { filter: input.filter, q: input.query })
    const nowMs = Date.now()
    const since = new Date(nowMs - DAY_MS).toISOString()
    const [workspaces, stats, installs, connections, errors] = await Promise.all([
        client
            .from("workspaces")
            .select("id, owner_id, name, status, plan_code, paid_until, created_at")
            .order("created_at", { ascending: false })
            .limit(1000),
        client.rpc("admin_console_workspace_stats"),
        client.from("module_installations").select("workspace_id, module_key, status, live_enabled").limit(5000),
        client
            .from("connections")
            .select("workspace_id, provider, status, environment, last_event_at, created_at")
            .neq("status", "disconnected")
            .limit(5000),
        client
            .from("app_errors")
            .select("workspace_id")
            .gte("created_at", since)
            .not("workspace_id", "is", null)
            .limit(5000),
    ])
    const rows = toOutcome(workspaces)
    if (rows.kind !== "ok") return rows
    if (stats.error !== null) return rpcFailure(stats.error)
    if (installs.error !== null || connections.error !== null || errors.error !== null) {
        return dbFailure("unavailable", "admin-list")
    }
    const items = workspaceItemsOf({
        workspaces: rows.value,
        stats: stats.data,
        installs: installs.data,
        connections: connections.data,
        errors: errors.data,
        emails: await emailsOf(
            client,
            rows.value.map((row) => row.owner_id),
        ),
        nowMs,
    })
    return dbOk(workspaceListOf(items, input.filter, input.query))
}

/** Reads the full read-only overview of one workspace. */
export const readAdminWorkspace = async (workspaceId: string): Promise<DbOutcome<AdminWorkspaceDetail>> => {
    const client = await createServerDbClient()
    const admin = await requireAdmin(client)
    if (admin.kind !== "ok") return admin
    const [workspaceRows, members, invites, orders, events, installs, versions, syncs] = await Promise.all([
        client
            .from("workspaces")
            .select("id, owner_id, name, status, plan_code, paid_until, created_at")
            .eq("id", workspaceId)
            .limit(1),
        client
            .from("workspace_members")
            .select("user_id, role, display_name, status")
            .eq("workspace_id", workspaceId)
            .order("created_at")
            .limit(500),
        client
            .from("workspace_invites")
            .select("id, email, role, created_at, expires_at")
            .eq("workspace_id", workspaceId)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false })
            .limit(200),
        client
            .from("payment_orders")
            .select("id, order_code, plan_code, amount_vnd, status, created_at, paid_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(30),
        client
            .from("billing_events")
            .select("id, kind, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(20),
        client
            .from("module_installations")
            .select("id, module_key, status, operating_mode, live_enabled, active_context_version_id, settings")
            .eq("workspace_id", workspaceId)
            .limit(50),
        client
            .from("module_context_versions")
            .select("id, version, applied_at")
            .eq("workspace_id", workspaceId)
            .limit(500),
        client
            .from("openclaw_agent_sync")
            .select("installation_id, agent_id, context_version, checked_at, status, error")
            .eq("workspace_id", workspaceId)
            .limit(50),
    ])
    const [connections, errors, sources, stats, quota, override] = await Promise.all([
        client
            .from("connections")
            .select("id, provider, name, status, environment, last_event_at, last_error, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at")
            .limit(200),
        client
            .from("app_errors")
            .select("id, scope, message, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(20),
        client.from("knowledge_sources").select("kind, status").eq("workspace_id", workspaceId).limit(5000),
        client.rpc("admin_console_workspace_stats"),
        client.rpc("admin_console_quota", { p_workspace: workspaceId }),
        client.from("ai_quota_overrides").select("credits_limit").eq("workspace_id", workspaceId).limit(1),
    ])
    const found = toOutcome(workspaceRows)
    if (found.kind !== "ok") return found
    const workspace = found.value[0]
    if (workspace === undefined) return dbFailure("not-found", "WORKSPACES_NOT_FOUND")
    if (
        members.error !== null ||
        invites.error !== null ||
        orders.error !== null ||
        events.error !== null ||
        installs.error !== null ||
        versions.error !== null ||
        syncs.error !== null ||
        connections.error !== null ||
        errors.error !== null ||
        sources.error !== null ||
        override.error !== null
    ) {
        return dbFailure("unavailable", "admin-detail")
    }
    if (stats.error !== null) return rpcFailure(stats.error)
    if (quota.error !== null) return rpcFailure(quota.error)
    const transfers = await transfersOf(
        client,
        orders.data.map((order) => order.id),
    )
    if (transfers.kind !== "ok") return transfers
    const emails = await emailsOf(client, [workspace.owner_id, ...members.data.map((member) => member.user_id)])
    await audit(client, "view.workspace", workspaceId)
    const credits = isRecord(quota.data) ? quota.data : null
    return dbOk(
        workspaceDetailOf({
            workspace,
            members: members.data,
            invites: invites.data,
            orders: orders.data,
            transfers: transfers.value,
            billingEvents: events.data,
            installs: installs.data,
            versions: versions.data,
            syncs: syncs.data,
            connections: connections.data,
            errors: errors.data,
            sources: sources.data,
            activity: stats.data.find((row) => row.workspace_id === workspaceId) ?? null,
            quota:
                credits === null
                    ? null
                    : {
                          credits_used: numberOf(credits.credits_used),
                          credits_limit: numberOf(credits.credits_limit),
                          cost_usd: numberOf(credits.cost_usd) ?? 0,
                      },
            ownLimit: override.data[0]?.credits_limit ?? null,
            emails,
            nowMs: Date.now(),
        }),
    )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const numberOf = (value: unknown): number | null =>
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : null

/** Reads sign-ups, billing events, application errors and the latest audit rows. */
export const readAdminHealth = async (): Promise<DbOutcome<AdminHealth>> => {
    const client = await createServerDbClient()
    const admin = await requireAdmin(client)
    if (admin.kind !== "ok") return admin
    await audit(client, "view.health", null)
    const since = new Date(Date.now() - DAY_MS).toISOString()
    const [signups, transfers, events, errors, recent, audits] = await Promise.all([
        client.rpc("admin_console_signups", { p_days: 14 }),
        client
            .from("sepay_transactions")
            .select("status, transfer_amount, content, received_at")
            .order("received_at", { ascending: false })
            .limit(25),
        client
            .from("billing_events")
            .select("id, workspace_id, kind, created_at")
            .order("created_at", { ascending: false })
            .limit(25),
        client
            .from("app_errors")
            .select("id, scope, message, workspace_id, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
        client.from("app_errors").select("scope").gte("created_at", since).limit(5000),
        client
            .from("platform_audit")
            .select("id, actor_email, action, workspace_id, created_at")
            .neq("action", "view.health")
            .order("created_at", { ascending: false })
            .limit(15),
    ])
    if (signups.error !== null) return rpcFailure(signups.error)
    if (
        transfers.error !== null ||
        events.error !== null ||
        errors.error !== null ||
        recent.error !== null ||
        audits.error !== null
    ) {
        return dbFailure("unavailable", "admin-health")
    }
    const referenced = referencedWorkspaces({
        billingEvents: events.data,
        errors: errors.data,
        audits: audits.data,
    })
    const names = await namesOf(client, referenced)
    if (names.kind !== "ok") return names
    return dbOk(
        healthOf({
            signups: signups.data.map((row) => ({ day: row.day, signups: row.signups })),
            transfers: transfers.data,
            billingEvents: events.data,
            errors: errors.data,
            recentErrors: recent.data,
            audits: audits.data,
            names: names.value,
        }),
    )
}

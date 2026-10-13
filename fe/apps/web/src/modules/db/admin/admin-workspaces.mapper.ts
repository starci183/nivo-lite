import type { Database } from "../../../../../../../supabase/types/database.types"
import { connectionHealth, isoOrNull, iso } from "./admin.mapper"
import type { AdminConnectionBadge, AdminWorkspaceFilter, AdminWorkspaceItem, AdminWorkspaceList } from "./admin.mapper"

type Tables = Database["public"]["Tables"]
type Functions = Database["public"]["Functions"]

/** The workspace columns the list reads. */
export type ListWorkspaceRow = Pick<
    Tables["workspaces"]["Row"],
    "id" | "owner_id" | "name" | "status" | "plan_code" | "paid_until" | "created_at"
>
/** One row of `admin_console_workspace_stats`. */
export type ListStatsRow = Functions["admin_console_workspace_stats"]["Returns"][number]
/** The installation columns of the list. */
export type ListInstallRow = Pick<
    Tables["module_installations"]["Row"],
    "workspace_id" | "module_key" | "status" | "live_enabled"
>
/** The connection columns of the list. */
export type ListConnectionRow = Pick<
    Tables["connections"]["Row"],
    "workspace_id" | "provider" | "status" | "environment" | "last_event_at" | "created_at"
>
/** The columns that name the workspace of a captured error. */
export type ListErrorRow = Pick<Tables["app_errors"]["Row"], "workspace_id">

/** Everything the list is built from. */
export interface WorkspaceListInput {
    readonly workspaces: ReadonlyArray<ListWorkspaceRow>
    readonly stats: ReadonlyArray<ListStatsRow>
    readonly installs: ReadonlyArray<ListInstallRow>
    readonly connections: ReadonlyArray<ListConnectionRow>
    readonly errors: ReadonlyArray<ListErrorRow>
    readonly emails: ReadonlyMap<string, string>
    readonly nowMs: number
}

const connectionBadges = (
    connections: ReadonlyArray<ListConnectionRow>,
    nowMs: number,
): Array<AdminConnectionBadge> => {
    const byProvider = new Map<string, { provider: string; count: number; error: number; silent: number }>()
    for (const connection of connections) {
        const badge = byProvider.get(connection.provider) ?? {
            provider: connection.provider,
            count: 0,
            error: 0,
            silent: 0,
        }
        const health = connectionHealth(
            {
                status: connection.status,
                environment: connection.environment,
                lastEventAt: connection.last_event_at,
                createdAt: connection.created_at,
            },
            nowMs,
        )
        badge.count += 1
        if (health === "error") badge.error += 1
        if (health === "silent") badge.silent += 1
        byProvider.set(connection.provider, badge)
    }
    return [...byProvider.values()]
}

/** What needs a person's eyes: trouble, unpaid or no customer activity. */
const flagsOf = (
    facts: {
        readonly status: string
        readonly paidUntil: string | null
        readonly connectionWarning: boolean
        readonly errors24h: number
        readonly messages7d: number
    },
    nowMs: number,
): Pick<AdminWorkspaceItem, "attention" | "unpaid" | "idle7d"> => {
    const lapsed =
        facts.paidUntil !== null && new Date(facts.paidUntil).getTime() < nowMs && facts.status !== "cancelled"
    return {
        attention: facts.connectionWarning || facts.errors24h > 0 || facts.status === "past_due",
        unpaid: facts.status === "pending_payment" || facts.status === "past_due" || lapsed,
        idle7d: facts.messages7d === 0,
    }
}

/** Whether a workspace passes a filter and a free-text search (name, owner email, or the start of its id). */
const matches = (item: AdminWorkspaceItem, filter: AdminWorkspaceFilter, query: string): boolean => {
    if (filter === "attention" && !item.attention) return false
    if (filter === "unpaid" && !item.unpaid) return false
    if (filter === "idle" && !item.idle7d) return false
    const needle = query.trim().toLowerCase()
    return (
        needle === "" ||
        item.name.toLowerCase().includes(needle) ||
        item.ownerEmail?.toLowerCase().includes(needle) === true ||
        item.id.startsWith(needle)
    )
}

/** Builds every workspace item of the list, unfiltered. */
export const workspaceItemsOf = (input: WorkspaceListInput): ReadonlyArray<AdminWorkspaceItem> => {
    const statsBy = new Map(input.stats.map((row) => [row.workspace_id, row]))
    const errorsBy = new Map<string, number>()
    for (const row of input.errors) {
        if (row.workspace_id !== null) errorsBy.set(row.workspace_id, (errorsBy.get(row.workspace_id) ?? 0) + 1)
    }
    return input.workspaces.map((workspace): AdminWorkspaceItem => {
        const own = statsBy.get(workspace.id)
        const badges = connectionBadges(
            input.connections.filter((connection) => connection.workspace_id === workspace.id),
            input.nowMs,
        )
        const connectionWarning = badges.some((badge) => badge.error + badge.silent > 0)
        const errors24h = errorsBy.get(workspace.id) ?? 0
        const messages7d = own?.messages_7d ?? 0
        const paidUntil = isoOrNull(workspace.paid_until)
        return {
            id: workspace.id,
            name: workspace.name,
            ownerEmail: input.emails.get(workspace.owner_id) ?? null,
            status: workspace.status,
            planCode: workspace.plan_code,
            paidUntil,
            createdAt: iso(workspace.created_at),
            members: own?.members ?? 0,
            modules: input.installs
                .filter((install) => install.workspace_id === workspace.id)
                .map((install) => ({ key: install.module_key, status: install.status, live: install.live_enabled })),
            connections: badges,
            connectionWarning,
            lastCustomerMessageAt: isoOrNull(own?.last_customer_message_at),
            messages7d,
            openDecisions: own?.open_decisions ?? 0,
            errors24h,
            ...flagsOf({ status: workspace.status, paidUntil, connectionWarning, errors24h, messages7d }, input.nowMs),
        }
    })
}

/** Filters and searches the items and counts what each filter keeps. */
export const workspaceListOf = (
    items: ReadonlyArray<AdminWorkspaceItem>,
    filter: AdminWorkspaceFilter,
    query: string,
): AdminWorkspaceList => ({
    total: items.length,
    counts: {
        all: items.length,
        attention: items.filter((item) => matches(item, "attention", "")).length,
        unpaid: items.filter((item) => matches(item, "unpaid", "")).length,
        idle: items.filter((item) => matches(item, "idle", "")).length,
    },
    items: items.filter((item) => matches(item, filter, query)),
})

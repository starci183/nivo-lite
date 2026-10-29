import { creditsOf } from "@modules/domain/ai-usage-events"
import type {
    AdminConnectionBadge,
    AdminCount,
    AdminCredits,
    AdminKnowledgeKind,
    AdminWorkspaceItem,
    WorkspaceFilter,
} from "./platform-admin.contracts"
import type { QuotaOverrideFacts, QuotaFacts } from "./platform-admin.facts"

const DAY_MS = 86_400_000

/** A live connection with no event for this long counts as silent. */
export const SILENT_AFTER_MS = 3 * DAY_MS

/** How healthy one connection looks. */
export type ConnectionHealth = "ok" | "error" | "silent"

/** The facts a connection's health is judged from. */
export interface ConnectionFacts {
    /** The status. */
    readonly status: string
    /** The environment. */
    readonly environment: string | null
    /** The last event at. */
    readonly lastEventAt: string | null
    /** The created at. */
    readonly createdAt: string
}

/** Whether an email belongs to the platform team; anyone else, signed in or not, must not learn the console exists. */
export const isPlatformAdmin = (email: string | undefined, admins: ReadonlyArray<string>): boolean =>
    email !== undefined && admins.includes(email.trim().toLowerCase())

/** The health of one connection at `nowMs`: an error status, a live connection that went quiet, or fine. */
export const connectionHealth = (connection: ConnectionFacts, nowMs: number): ConnectionHealth => {
    if (connection.status === "error") return "error"
    const isLive = connection.status === "connected" && (connection.environment ?? "live") === "live"
    const since = new Date(connection.lastEventAt ?? connection.createdAt).getTime()
    return isLive && nowMs - since > SILENT_AFTER_MS ? "silent" : "ok"
}

/** Counts the rows of each workspace; platform-level rows (no workspace) are left out. */
export const countByWorkspace = (
    rows: ReadonlyArray<{ readonly workspace_id: string | null }>,
): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const row of rows) {
        if (row.workspace_id !== null) counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1)
    }
    return counts
}

/** One badge per provider with how many of its connections are in error or silent. */
export const summarizeConnections = (
    connections: ReadonlyArray<ConnectionFacts & { readonly provider: string }>,
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
        const health = connectionHealth(connection, nowMs)
        badge.count += 1
        if (health === "error") badge.error += 1
        if (health === "silent") badge.silent += 1
        byProvider.set(connection.provider, badge)
    }
    return [...byProvider.values()]
}

/** The facts the list flags are judged from. */
export interface FlagFacts {
    /** The status. */
    readonly status: string
    /** The paid until. */
    readonly paidUntil: string | null
    /** The connection warning. */
    readonly connectionWarning: boolean
    /** The errors24h. */
    readonly errors24h: number
    /** The messages7d. */
    readonly messages7d: number
}

/** What needs a person's eyes: trouble, unpaid or no customer activity. */
export const workspaceFlags = (
    facts: FlagFacts,
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
export const matchesWorkspace = (item: AdminWorkspaceItem, filter: WorkspaceFilter, query: string): boolean => {
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

/** How many workspaces each filter keeps, with no search. */
export const filterCounts = (items: ReadonlyArray<AdminWorkspaceItem>): Record<WorkspaceFilter, number> => ({
    all: items.length,
    attention: items.filter((item) => matchesWorkspace(item, "attention", "")).length,
    unpaid: items.filter((item) => matchesWorkspace(item, "unpaid", "")).length,
    idle: items.filter((item) => matchesWorkspace(item, "idle", "")).length,
})

/** The knowledge sources grouped by kind, each with its statuses counted. */
export const knowledgeByKind = (
    rows: ReadonlyArray<{ readonly kind: string; readonly status: string }>,
): Array<AdminKnowledgeKind> => {
    const kinds = new Map<string, Record<string, number>>()
    for (const row of rows) {
        const byStatus = kinds.get(row.kind) ?? {}
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
        kinds.set(row.kind, byStatus)
    }
    return [...kinds.entries()].map(([kind, byStatus]) => ({
        kind,
        byStatus: Object.entries(byStatus).map(([key, count]) => ({ key, count })),
    }))
}

/** Counts equal values, in order of first appearance. */
export const tally = (values: ReadonlyArray<string>): Array<AdminCount> => {
    const counts = new Map<string, number>()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    return [...counts.entries()].map(([key, count]) => ({ key, count }))
}

/** A number the driver may have answered as text (bigint, numeric), or null. */
export const numberOrNull = (value: string | number | null): number | null => (value === null ? null : Number(value))

/** The month's credits from the quota status and the workspace's own allowance; a workspace with no status shows zero use. */
export const creditsFrom = (quota: QuotaFacts | undefined, override: QuotaOverrideFacts | undefined): AdminCredits => {
    const costUsd = quota === undefined ? 0 : Number(quota.cost_usd)
    const reported = quota === undefined ? null : numberOrNull(quota.credits_used)
    return {
        used: reported ?? creditsOf(costUsd),
        limit: quota === undefined ? null : numberOrNull(quota.credits_limit),
        costUsd,
        ownLimit: override === undefined ? null : numberOrNull(override.credits_limit),
    }
}

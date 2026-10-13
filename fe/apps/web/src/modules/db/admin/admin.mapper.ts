/** The platform admin the console is open for. */
export interface AdminSession {
    readonly email: string
}

/** The list filters of the console. */
export type AdminWorkspaceFilter = "all" | "attention" | "unpaid" | "idle"

/** The billing status a support action can set. */
export type AdminSupportStatus = "active" | "past_due"

/** True when a filter name the address carried is one the list knows. */
export const isAdminWorkspaceFilter = (value: unknown): value is AdminWorkspaceFilter =>
    value === "all" || value === "attention" || value === "unpaid" || value === "idle"

/** One connection badge of a workspace row: how many of a provider, and how many in error or silent. */
export interface AdminConnectionBadge {
    readonly provider: string
    readonly count: number
    readonly error: number
    readonly silent: number
}

/** One customer workspace as the list shows it. */
export interface AdminWorkspaceItem {
    readonly id: string
    readonly name: string
    readonly ownerEmail: string | null
    readonly status: string
    readonly planCode: string | null
    readonly paidUntil: string | null
    readonly createdAt: string
    readonly members: number
    readonly modules: ReadonlyArray<{ readonly key: string; readonly status: string; readonly live: boolean }>
    readonly connections: ReadonlyArray<AdminConnectionBadge>
    readonly connectionWarning: boolean
    readonly lastCustomerMessageAt: string | null
    readonly messages7d: number
    readonly openDecisions: number
    readonly errors24h: number
    readonly attention: boolean
    readonly unpaid: boolean
    readonly idle7d: boolean
}

/** The filtered list with the size of every filter. */
export interface AdminWorkspaceList {
    readonly total: number
    readonly counts: Readonly<Record<AdminWorkspaceFilter, number>>
    readonly items: ReadonlyArray<AdminWorkspaceItem>
}

/** The full read-only overview of one workspace. */
export interface AdminWorkspaceDetail {
    readonly workspace: {
        readonly id: string
        readonly name: string
        readonly ownerEmail: string | null
        readonly status: string
        readonly planCode: string | null
        readonly paidUntil: string | null
        readonly createdAt: string
    }
    readonly credits: {
        readonly used: number
        readonly limit: number | null
        readonly costUsd: number
        readonly ownLimit: number | null
    }
    readonly members: ReadonlyArray<{
        readonly userId: string
        readonly role: string
        readonly displayName: string
        readonly status: string
        readonly email: string | null
    }>
    readonly invites: ReadonlyArray<{
        readonly id: string
        readonly email: string
        readonly role: string
        readonly createdAt: string
        readonly expiresAt: string
    }>
    readonly orders: ReadonlyArray<{
        readonly id: string
        readonly orderCode: string
        readonly planCode: string
        readonly amountVnd: number
        readonly status: string
        readonly createdAt: string
        readonly paidAt: string | null
    }>
    readonly transfers: ReadonlyArray<{
        readonly sepayId: number
        readonly transferAmount: number | null
        readonly content: string | null
        readonly status: string
        readonly receivedAt: string
    }>
    readonly billingEvents: ReadonlyArray<{ readonly id: string; readonly kind: string; readonly createdAt: string }>
    readonly modules: ReadonlyArray<{
        readonly id: string
        readonly key: string
        readonly status: string
        readonly operatingMode: string
        readonly live: boolean
        readonly processor: string
        readonly contextVersion: number | null
        readonly contextAppliedAt: string | null
        readonly sync: {
            readonly agentId: string
            readonly contextVersion: number | null
            readonly checkedAt: string
            readonly status: string
            readonly error: string | null
        } | null
    }>
    readonly connections: ReadonlyArray<{
        readonly id: string
        readonly provider: string
        readonly name: string
        readonly status: string
        readonly environment: string
        readonly lastEventAt: string | null
        readonly lastError: string | null
        readonly health: string
    }>
    readonly errors: ReadonlyArray<{
        readonly id: string
        readonly scope: string
        readonly message: string
        readonly createdAt: string
    }>
    readonly knowledgeTotal: number
    readonly knowledge: ReadonlyArray<{ readonly kind: string; readonly byStatus: Readonly<Record<string, number>> }>
    readonly activity: {
        readonly messages7d: number
        readonly lastCustomerMessageAt: string | null
        readonly openDecisions: number
    }
}

/** A count by key. */
export interface AdminCount {
    readonly key: string
    readonly count: number
}

/** The platform health page. */
export interface AdminHealth {
    readonly signups: ReadonlyArray<{ readonly day: string; readonly signups: number }>
    readonly transfers: ReadonlyArray<{
        readonly status: string
        readonly transferAmount: number | null
        readonly content: string | null
        readonly receivedAt: string
    }>
    readonly transferCounts: ReadonlyArray<AdminCount>
    readonly billingEvents: ReadonlyArray<{
        readonly id: string
        readonly workspaceId: string | null
        readonly kind: string
        readonly createdAt: string
    }>
    readonly errors: ReadonlyArray<{
        readonly id: string
        readonly scope: string
        readonly message: string
        readonly workspaceId: string | null
        readonly createdAt: string
    }>
    readonly errorScopes: ReadonlyArray<AdminCount>
    readonly audits: ReadonlyArray<{
        readonly id: string
        readonly actorEmail: string
        readonly action: string
        readonly workspaceId: string | null
        readonly createdAt: string
    }>
    readonly workspaceNames: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

/** What resending an invitation answers. */
export interface AdminInviteResent {
    readonly email: string
    readonly delivery: "invited" | "existing" | "none"
}

/** A connection with no event for this long counts as silent. */
const SILENT_AFTER_MS = 3 * 86_400_000

/** How healthy one connection looks. */
export type ConnectionHealth = "ok" | "error" | "silent"

/** The facts a connection's health is judged from. */
export interface ConnectionFacts {
    readonly status: string
    readonly environment: string | null
    readonly lastEventAt: string | null
    readonly createdAt: string
}

/** The health of one connection at `nowMs`: an error status, a live connection that went quiet, or fine. */
export const connectionHealth = (connection: ConnectionFacts, nowMs: number): ConnectionHealth => {
    if (connection.status === "error") return "error"
    const isLive = connection.status === "connected" && (connection.environment ?? "live") === "live"
    const since = new Date(connection.lastEventAt ?? connection.createdAt).getTime()
    return isLive && nowMs - since > SILENT_AFTER_MS ? "silent" : "ok"
}

/** Counts equal values, in order of first appearance. */
export const tally = (values: ReadonlyArray<string>): Array<AdminCount> => {
    const counts = new Map<string, number>()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    return [...counts.entries()].map(([key, count]) => ({ key, count }))
}

/** A number the driver may have answered as text (bigint, numeric), or null. */
export const numberOrNull = (value: string | number | null | undefined): number | null =>
    value === null || value === undefined ? null : Number(value)

/** An instant as ISO 8601 text. */
export const iso = (value: string): string => new Date(value).toISOString()

/** An instant as ISO 8601 text, or null. */
export const isoOrNull = (value: string | null | undefined): string | null =>
    value === null || value === undefined ? null : iso(value)

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const ADMIN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Bounds a workspace id and a number of days before a function takes them. */
export const extendInputSchema = {
    safeParse: (workspaceId: string, days: number): Parsed<{ readonly workspaceId: string; readonly days: number }> =>
        ADMIN_ID.test(workspaceId) && Number.isInteger(days)
            ? { success: true, data: { workspaceId, days } }
            : { success: false },
}

/** Bounds a workspace id and the billing status to set. */
export const statusInputSchema = {
    safeParse: (
        workspaceId: string,
        status: string,
    ): Parsed<{ readonly workspaceId: string; readonly status: AdminSupportStatus }> =>
        ADMIN_ID.test(workspaceId) && (status === "active" || status === "past_due")
            ? { success: true, data: { workspaceId, status } }
            : { success: false },
}

/** Bounds a workspace id, a plan code and the own credit limit. */
export const planInputSchema = {
    safeParse: (
        workspaceId: string,
        planCode: string,
        creditsLimit: number | null,
    ): Parsed<{ readonly workspaceId: string; readonly planCode: string; readonly creditsLimit: number | null }> =>
        ADMIN_ID.test(workspaceId) && planCode !== "" && (creditsLimit === null || Number.isInteger(creditsLimit))
            ? { success: true, data: { workspaceId, planCode, creditsLimit } }
            : { success: false },
}

/** Bounds a workspace id and an invitation id. */
export const resendInputSchema = {
    safeParse: (
        workspaceId: string,
        inviteId: string,
    ): Parsed<{ readonly workspaceId: string; readonly inviteId: string }> =>
        ADMIN_ID.test(workspaceId) && ADMIN_ID.test(inviteId)
            ? { success: true, data: { workspaceId, inviteId } }
            : { success: false },
}

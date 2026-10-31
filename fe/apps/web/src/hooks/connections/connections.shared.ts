import { isProvider } from "@/hooks/connection-providers"
import type { Connection, ConnectionStatus, DataSlot, Provider } from "@/modules/types"

/** Connection rows: what needs attention first, then what runs, then what was disconnected. */
const STATUS_RANK: Readonly<Record<ConnectionStatus, number>> = { error: 0, pending: 0, connected: 1, disconnected: 2 }

/** Sorts connection rows by attention, keeping the creation order inside each rank. */
export const sortRows = (rows: ReadonlyArray<Connection>): ReadonlyArray<Connection> =>
    [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])

/** The badge tone of a connection status. */
export const statusTone = (status: ConnectionStatus): "success" | "danger" | "warning" | "neutral" => {
    if (status === "connected") return "success"
    if (status === "error") return "danger"
    return status === "pending" ? "warning" : "neutral"
}

/** The catalog key of a connection status label. */
export const statusKey = (status: ConnectionStatus): string => {
    if (status === "connected") return "statusConnected"
    if (status === "pending") return "statusPending"
    return status === "error" ? "statusError" : "statusDisconnected"
}

/** The row state the list shows for a connection status. */
export const rowState = (status: ConnectionStatus): "negative" | "cautionary" | "unavailable" | "neutral" => {
    if (status === "error") return "negative"
    if (status === "pending") return "cautionary"
    return status === "disconnected" ? "unavailable" : "neutral"
}

/** The connections of the workspace that still run (everything but disconnected). */
export const liveConnections = (items: ReadonlyArray<Connection>): ReadonlyArray<Connection> =>
    items.filter((connection) => connection.status !== "disconnected")

/** The connections that need the owner (unfinished setup or a broken connection). */
export const attentionConnections = (items: ReadonlyArray<Connection>): ReadonlyArray<Connection> =>
    liveConnections(items).filter((connection) => connection.status === "pending" || connection.status === "error")

/** The console destinations the Connections page links to. */
export const CONNECTION_ROUTES = {
    dashboard: "/dashboard",
    chat: "/chat",
    automations: "/automations",
    connections: "/connections",
} as const

/** The URL segment of the providers that have a page of their own: `/connections/<segment>/<connection id>`. */
const PAGE_SEGMENT: Readonly<Partial<Record<Provider, string>>> = { sepay: "sepay", zalo_oa: "zalo" }

/**
 * The page of one connection when its provider has one (SePay, Zalo OA) and the page has something to show, else null. A connection
 * that is still pending is finished in its wizard and a disconnected one has no page, so only a connected or failing one links.
 */
export const connectionPageHref = (connection: Pick<Connection, "id" | "provider" | "status">): string | null => {
    const segment = PAGE_SEGMENT[connection.provider]
    if (segment === undefined || (connection.status !== "connected" && connection.status !== "error")) return null
    return `${CONNECTION_ROUTES.connections}/${segment}/${connection.id}`
}

/** The search params the console uses to remember which overlay is open. */
export const URL_PARAMS = { connect: "connect", connection: "conn", detail: "detail", tab: "tab" } as const

/** The query string (without the question mark) a wizard open produces. */
export const wizardQuery = (provider: Provider, connectionId?: string): string => {
    const params = new URLSearchParams({ [URL_PARAMS.connect]: provider })
    if (connectionId !== undefined) params.set(URL_PARAMS.connection, connectionId)
    return params.toString()
}

/**
 * What the open wizard drawer is told by the URL: the provider, the connection it resumes and an OAuth return state.
 */
export interface WizardTarget {
    readonly provider: Provider
    readonly resumeId?: string
    readonly returned?: string
}

/** A reader of one search param (`URLSearchParams.get`). */
export type ParamReader = (name: string) => string | null

const ownedBy = (
    items: ReadonlyArray<Pick<Connection, "id" | "provider">>,
    id: string | null,
    provider: Provider,
): string | undefined =>
    id !== null && items.some((item) => item.id === id && item.provider === provider) ? id : undefined

const returnedOf = (read: ParamReader, name: string): { readonly returned?: string } => {
    const value = read(name)
    return value === null ? {} : { returned: value }
}

/**
 * Which wizard the URL asks for. An OAuth return names its connection with `id` (Zalo or Meta), a Google return has
 * `google`, and the console opens its own with `connect` and an optional `conn`. A resume id counts only when the
 * workspace owns it.
 */
export const wizardTargetOf = (
    read: ParamReader,
    items: ReadonlyArray<Pick<Connection, "id" | "provider">>,
): WizardTarget | null => {
    const id = read("id")
    const zalo = ownedBy(items, id, "zalo_oa")
    if (zalo !== undefined) return { provider: "zalo_oa", resumeId: zalo, ...returnedOf(read, "zalo") }
    const meta = ownedBy(items, id, "meta")
    if (meta !== undefined) return { provider: "meta", resumeId: meta, ...returnedOf(read, "meta") }
    if ((read("google") ?? "") !== "") return { provider: "google" }
    const connect = read(URL_PARAMS.connect)
    if (connect === null || !isProvider(connect)) return null
    const resume = ownedBy(items, read(URL_PARAMS.connection), connect)
    return resume === undefined ? { provider: connect } : { provider: connect, resumeId: resume }
}

/** The bank and payment providers the money wizard sets up. */
export type MoneyProviderId = "sepay" | "payos" | "casso"

/** The money provider behind a provider id, or null when the provider is not a bank feed. */
export const moneyProviderOf = (provider: Provider): MoneyProviderId | null => {
    if (provider === "sepay" || provider === "payos" || provider === "casso") return provider
    return null
}

/**
 * True when providers cannot reach the site: no address, plain http, or a local host (a webhook cannot be registered
 * there).
 */
export const isLocalOnly = (siteUrl: string | undefined): boolean => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return true
    const url = new URL(siteUrl)
    const local =
        url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]"
    return url.protocol !== "https:" || local
}

/** What decides the status of a board: the workspace reads and, when the board is for managers, the viewer's role. */
interface BoardRead {
    readonly isLoading: boolean
    /** False when the viewer may not see the board; true when the board has no role gate. */
    readonly isManager: boolean
    readonly isFailed: boolean
}

/** Loading and access take priority over the result of the workspace reads. */
export const boardSlotOf = <T>(read: BoardRead, board: T): DataSlot<T> => {
    if (read.isLoading) return { isLoading: true }
    if (!read.isManager) return { isForbidden: true }
    return read.isFailed ? { isError: true } : { items: board }
}

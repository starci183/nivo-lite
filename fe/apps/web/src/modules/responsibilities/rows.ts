import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { dayOffset, dueText } from "./days"

/** Where a responsibility stands. */
export type RowStatus = "open" | "waiting_approval" | "done"

/** The statuses, in the order the tabs show them. */
export const ROW_STATUSES: ReadonlyArray<RowStatus> = ["open", "waiting_approval", "done"]

/** The due filters a link can preselect. */
export const DUES = ["any", "overdue", "today", "week", "none"] as const

/** One due filter. */
export type DueKey = (typeof DUES)[number]

/** The status a text names, or none. */
export const rowStatusOf = (value: string): RowStatus | null => ROW_STATUSES.find((status) => status === value) ?? null

/** The due filter a text names, or none. */
export const rowDueOf = (value: string): DueKey | null => DUES.find((due) => due === value) ?? null

/** The message keys of the responsibilities catalog the row words come from. */
export type RespKey =
    | "statusOpen"
    | "statusWaiting"
    | "statusDone"
    | "noDue"
    | "overdueDays"
    | "overdueYesterday"
    | "dueToday"
    | "dueTomorrow"
    | "dueInDays"
    | "justNow"
    | "minAgo"
    | "hourAgo"
    | "yesterday"
    | "daysAgo"

/** Translator for the responsibilities catalog (next-intl on the client, the request-free one on the server). */
export type RespT = (key: RespKey, vars?: Record<string, string | number>) => string

/** One responsibility, resolved for display. */
export interface ResponsibilityRowView {
    readonly id: string
    readonly leadId: string
    readonly customer: string
    readonly title: string
    readonly nextAction: string
    readonly dueLabel: string | null
    readonly dueAt: string | null
    readonly createdAt: string
    readonly isOverdue: boolean
    readonly isDueToday: boolean
    readonly isDueThisWeek: boolean
    readonly status: RowStatus
    readonly statusLabel: string
    readonly ownerKey: string
    readonly ownerName: string
    readonly ownerKind: "human" | "agent"
    readonly ownerHandle: string | null
}

/** The owners that hold rows, in display order. */
export interface OwnerGroupView {
    readonly key: string
    readonly name: string
    readonly kind: "human" | "agent"
    readonly handle: string | null
    /** SVG path data of the glyph an agent owner is drawn with. */
    readonly glyph: string
    readonly rows: ReadonlyArray<ResponsibilityRowView>
}

/** Status wording shared by the badge and the tabs. */
const statusLabel = (t: RespT, status: RowStatus): string => {
    if (status === "open") return t("statusOpen")
    return status === "waiting_approval" ? t("statusWaiting") : t("statusDone")
}

/** What a row is built from, whichever side read it. */
export interface RowSource {
    readonly id: string
    readonly leadId: string
    readonly customer: string
    readonly title: string
    readonly nextAction: string
    readonly dueAt: string | null
    readonly createdAt: string
    readonly status: RowStatus
    readonly ownerKind: "human" | "agent"
    readonly ownerAgentId: string | null
    readonly ownerName: string
}

/** One display row from its source, with the agent that owns it when there is one. */
export const rowOf = (
    source: RowSource,
    agent: { readonly name: string; readonly handle: string } | undefined,
    now: Date,
    t: RespT,
): ResponsibilityRowView => {
    const isDone = source.status === "done"
    const offset = source.dueAt === null || isDone ? null : dayOffset(source.dueAt, now)
    const noDue = isDone ? null : t("noDue")
    const ownerRef = source.ownerKind === "agent" ? (source.ownerAgentId ?? source.ownerName) : source.ownerName
    return {
        id: source.id,
        leadId: source.leadId,
        customer: source.customer,
        title: source.title,
        nextAction: source.nextAction,
        dueLabel: offset === null ? noDue : dueText(t, offset),
        dueAt: isDone ? null : source.dueAt,
        createdAt: source.createdAt,
        isOverdue: offset !== null && offset < 0,
        isDueToday: offset === 0,
        isDueThisWeek: offset !== null && offset >= 0 && offset <= 7,
        status: source.status,
        statusLabel: statusLabel(t, source.status),
        ownerKey: `${source.ownerKind}:${ownerRef}`,
        ownerName: agent?.name ?? source.ownerName,
        ownerKind: source.ownerKind,
        ownerHandle: agent === undefined ? null : agent.handle,
    }
}

/** The back end `responsibilities` line (text fields; the closed sets are checked here). */
interface ResponsibilityWire {
    readonly id: string
    readonly lead_id: string
    readonly contact_name: string
    readonly title: string
    readonly next_action: string
    readonly due_at?: string | null
    readonly created_at: string
    readonly status: string
    readonly owner_kind: string
    readonly owner_agent_id?: string | null
    readonly owner_name: string
}

/** The agent facts a row needs: who the @handle belongs to. */
interface AgentHandle {
    readonly id: string
    readonly name: string
    readonly handle: string
}

/** Resolve the back end responsibilities into display rows; a value outside a closed set reads as the safe one. */
export const toRowModelsFromWire = (
    list: ReadonlyArray<ResponsibilityWire>,
    agents: ReadonlyArray<AgentHandle>,
    now: Date,
    t: RespT,
): ReadonlyArray<ResponsibilityRowView> =>
    list.map((r) => {
        const ownerKind = r.owner_kind === "agent" ? "agent" : "human"
        const source: RowSource = {
            id: r.id,
            leadId: r.lead_id,
            customer: r.contact_name,
            title: r.title,
            nextAction: r.next_action,
            dueAt: r.due_at ?? null,
            createdAt: r.created_at,
            status: rowStatusOf(r.status) ?? "open",
            ownerKind,
            ownerAgentId: r.owner_agent_id ?? null,
            ownerName: r.owner_name,
        }
        return rowOf(source, ownerKind === "agent" ? agents.find((a) => a.id === r.owner_agent_id) : undefined, now, t)
    })

/** The glyph of the module an agent runs; an unknown key reads as the chatbot. */
const glyphOf = (handle: string | null): string =>
    MODULE_REGISTRY[handle !== null && isModuleKey(handle) ? handle : "chatbot"].glyph

/** Group rows by owner. Owners with the most rows first, humans before agents on a tie. */
export const groupRowsByOwner = (rows: ReadonlyArray<ResponsibilityRowView>): Array<OwnerGroupView> => {
    const order = [...new Set(rows.map((row) => row.ownerKey))]
    return order
        .map((key): OwnerGroupView => {
            const members = rows.filter((row) => row.ownerKey === key)
            const first = members[0]
            return {
                key,
                name: first?.ownerName ?? key,
                kind: first?.ownerKind ?? "human",
                handle: first?.ownerHandle ?? null,
                glyph: glyphOf(first?.ownerHandle ?? null),
                rows: members,
            }
        })
        .sort((a, b) => b.rows.length - a.rows.length || b.kind.localeCompare(a.kind))
}

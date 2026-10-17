import type { DashboardType } from "@/hooks/swr"
import type { useFormatter, useTranslations } from "next-intl"

/** The dashboard as the back end answers it. */
type Dashboard = DashboardType

/** The translator of the responsibilities catalog. */
export type RowsTranslator = ReturnType<typeof useTranslations>

/** The reader's number and date formatter. */
export type RowsFormat = ReturnType<typeof useFormatter>

/** Where a responsibility stands. */
export type ResponsibilityStatus = "open" | "waiting_approval" | "done"

/** One responsibility, resolved for display. */
export interface ResponsibilityRowModel {
    readonly id: string
    readonly leadId: string
    readonly customer: string
    readonly title: string
    readonly nextAction: string
    readonly dueLabel: string | null
    readonly isOverdue: boolean
    readonly isDueToday: boolean
    readonly status: ResponsibilityStatus
    readonly statusLabel: string
    readonly ownerKey: string
    readonly ownerName: string
    readonly ownerKind: "human" | "agent"
    readonly ownerHandle: string | null
}

/** The owners that hold rows, in display order. */
export interface OwnerGroupModel {
    readonly key: string
    readonly name: string
    readonly kind: "human" | "agent"
    readonly handle: string | null
    readonly rows: Array<ResponsibilityRowModel>
}

/** One recent event, resolved for display. */
export interface ActivityModel {
    readonly id: string
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly timeLabel: string
    readonly leadId: string | null
}

/** The product time zone (Asia/Ho_Chi_Minh) is a fixed UTC+7 offset all year: it has no daylight saving. */
const ZONE_OFFSET_MS = 7 * 3_600_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/** Calendar day in the product time zone, as a day number. */
const dayNumber = (date: Date): number => Math.floor((date.getTime() + ZONE_OFFSET_MS) / DAY_MS)

/** Hour of day (0-23) in the product time zone. */
export const hourInZone = (date: Date): number => Math.floor(((date.getTime() + ZONE_OFFSET_MS) % DAY_MS) / HOUR_MS)

const statusOf = (value: string): ResponsibilityStatus =>
    value === "done" || value === "waiting_approval" ? value : "open"

const dueText = (t: RowsTranslator, offset: number): string => {
    if (offset < -1) return t("overdueDays", { n: -offset })
    if (offset === -1) return t("overdueYesterday")
    if (offset === 0) return t("dueToday")
    if (offset === 1) return t("dueTomorrow")
    return t("dueInDays", { n: offset })
}

const statusLabelOf = (t: RowsTranslator, status: ResponsibilityStatus): string => {
    if (status === "open") return t("statusOpen")
    return status === "waiting_approval" ? t("statusWaiting") : t("statusDone")
}

/** Relative time such as "5 min ago", "3 h ago" or "2 days ago". */
const relativeTime = (t: RowsTranslator, iso: string, now: Date): string => {
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / MINUTE_MS))
    if (minutes < 1) return t("justNow")
    if (minutes < 60) return t("minAgo", { n: minutes })
    const hours = Math.round(minutes / 60)
    if (hours < 24) return t("hourAgo", { n: hours })
    const days = Math.round(hours / 24)
    return days === 1 ? t("yesterday") : t("daysAgo", { n: days })
}

/** Resolves the responsibilities into display rows, with the owner's handle looked up from the agents. */
export const toRowModels = (
    list: Dashboard["responsibilities"],
    agents: Dashboard["agents"],
    now: Date,
    t: RowsTranslator,
): Array<ResponsibilityRowModel> =>
    list.map((r) => {
        const isAgent = r.ownerKind === "agent"
        const agent = isAgent ? agents.find((a) => a.id === r.ownerAgentId) : undefined
        const status = statusOf(r.status)
        const isDone = status === "done"
        const offset =
            r.dueAt === null || r.dueAt === undefined || isDone ? null : dayNumber(new Date(r.dueAt)) - dayNumber(now)
        const noDue = isDone ? null : t("noDue")
        return {
            id: r.id,
            leadId: r.leadId,
            customer: `${r.lead.contactName} · ${r.lead.company}`,
            title: r.title,
            nextAction: r.nextAction,
            dueLabel: offset === null ? noDue : dueText(t, offset),
            isOverdue: offset !== null && offset < 0,
            isDueToday: offset === 0,
            status,
            statusLabel: statusLabelOf(t, status),
            ownerKey: isAgent ? `agent:${r.ownerAgentId ?? r.ownerName}` : `human:${r.ownerName}`,
            ownerName: agent?.name ?? r.ownerName,
            ownerKind: isAgent ? "agent" : "human",
            ownerHandle: agent?.handle ?? null,
        }
    })

/** Groups rows by owner. Owners with the most rows first, humans before agents on a tie. */
export const groupByOwner = (rows: ReadonlyArray<ResponsibilityRowModel>): Array<OwnerGroupModel> => {
    const groups = new Map<string, OwnerGroupModel>()
    for (const row of rows) {
        const group = groups.get(row.ownerKey)
        if (group === undefined) {
            groups.set(row.ownerKey, {
                key: row.ownerKey,
                name: row.ownerName,
                kind: row.ownerKind,
                handle: row.ownerHandle,
                rows: [row],
            })
        } else {
            group.rows.push(row)
        }
    }
    return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || b.kind.localeCompare(a.kind))
}

/** Resolves the events into display rows. */
export const toActivityModels = (events: Dashboard["events"], now: Date, t: RowsTranslator): Array<ActivityModel> =>
    events.map((e) => ({
        id: e.id,
        kind: e.kind,
        actor: e.actor,
        summary: e.summary,
        timeLabel: relativeTime(t, e.createdAt, now),
        leadId: e.leadId ?? null,
    }))

/** Short absolute stamp such as "10:00, 29 Sep", in the reader's language. */
export const stampOf = (format: RowsFormat, date: Date): string =>
    `${format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}, ${format.dateTime(date, { day: "numeric", month: "short" })}`

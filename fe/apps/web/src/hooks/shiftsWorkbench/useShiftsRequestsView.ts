interface RequestItemInput {
    readonly id: string
    readonly title: string
    readonly notes: ReadonlyArray<string>
    readonly status: string
    readonly item: ShiftsWorkItemView | null
}
interface SwapTitleInput {
    readonly kind: string
    readonly from: string | null
    readonly to: string
    readonly shiftLine: string
}
import { useShiftsRequestsActions } from "./useShiftsRequestsActions"
import type { ShiftsRequestViews, ShiftsWorkItemView } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type RequestRowView = ShiftsRequestViews["requestsRequestRowView"]
type RequestSectionView = ShiftsRequestViews["requestsRequestSectionView"]

import { useTranslations } from "next-intl"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"

/** State values and commands consumed by the connected surface. */
type ShiftsRequestsControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly busy: boolean
}

/** Narrowed schedule data available after the access guard. */
type CreateShiftsRequestsRowsInput = ShiftsRequestsControllerInput & {
    bench: NonNullable<ShiftsRequestsControllerInput["bench"]>
}

const RECENT_LIMIT = 8

const createShiftsRequestsRows = (context: CreateShiftsRequestsRowsInput) => {
    const { t, bench, format } = context
    const { staff } = bench.setup
    const { leaves, swaps, availability } = bench.requests
    const name = (id: string | null): string => staff.find((person) => person.id === id)?.name ?? "-"
    const span = (from: string, to: string): string =>
        to === from ? format.dayMonth(from) : `${format.dayMonth(from)} - ${format.dayMonth(to)}`
    const statusOf = (status: string, item: ShiftsWorkItemView | null): Pick<RequestRowView, "tone" | "badge"> => {
        if (status === "approved")
            return { tone: "success", badge: t(item?.decidedPath === "auto" ? "stAuto" : "stApproved") }
        if (status === "declined") return { tone: "neutral", badge: t("stDeclined") }
        return { tone: "warning", badge: t(item?.status === "waiting_decision" ? "stWaiting" : "stPending") }
    }
    const itemRow = (input: RequestItemInput): RequestRowView => {
        const { id, title, notes, status, item } = input
        return {
            id,
            title,
            notes: notes.filter((note) => note !== ""),
            ...statusOf(status, item),
            decision: item?.status === "waiting_decision" ? { kind: "item", targetId: item.id } : null,
        }
    }
    const leaveTitle = (from: string, to: string, staffId: string): string => {
        const end = to === from ? "" : ` - ${format.dayMonth(to)}`
        return `${name(staffId)}: ${format.dayFull(from)}${end}`
    }
    const swapTitle = (input: SwapTitleInput): string => {
        const { kind, from, to, shiftLine } = input
        return kind === "claim"
            ? t("claimLine", { name: name(to), shift: shiftLine })
            : t("swapLine", { from: name(from), to: name(to), shift: shiftLine })
    }
    return { ...context, staff, leaves, swaps, availability, name, span, statusOf, itemRow, leaveTitle, swapTitle }
}

const createShiftsRequestsSections = (context: ReturnType<typeof createShiftsRequestsRows>) => {
    const { t, format, leaves, swaps, availability, name, itemRow, leaveTitle, swapTitle } = context
    const sections: Array<RequestSectionView> = [
        {
            id: "leave",
            title: t("reqLeave"),
            hint: t("reqLeaveHint"),
            rows: leaves
                .filter((leave) => leave.status === "pending")
                .map((leave) =>
                    itemRow({
                        id: leave.id,
                        title: leaveTitle(leave.from, leave.to, leave.staffId),
                        notes: [leave.reason, leave.item?.summary ?? ""],
                        status: leave.status,
                        item: leave.item,
                    }),
                ),
        },
        {
            id: "swap",
            title: t("reqSwap"),
            hint: t("reqSwapHint"),
            rows: swaps
                .filter((swap) => swap.status === "pending")
                .map((swap) =>
                    itemRow({
                        id: swap.id,
                        title: swapTitle({
                            kind: swap.kind,
                            from: swap.fromStaffId,
                            to: swap.toStaffId,
                            shiftLine: swap.shiftLine,
                        }),
                        notes: [
                            swap.checks.length > 0 ? `${t("outsideRules")}: ${swap.checks.join(" ")}` : "",
                            swap.reason,
                        ],
                        status: swap.status,
                        item: swap.item,
                    }),
                ),
        },
        {
            id: "availability",
            title: t("reqAvail"),
            hint: t("reqAvailHint"),
            rows: availability
                .filter((row) => row.status === "pending")
                .map((row) => ({
                    id: row.id,
                    title: `${name(row.staffId)}: ${t(row.available ? "canWork" : "cannotWork")} ${row.date === null ? format.weekdayName(row.weekday ?? 0, "long") : format.dayMonth(row.date)} ${row.start}-${row.end}`,
                    notes: row.note === "" ? [] : [row.note],
                    tone: "warning",
                    badge: t("stPending"),
                    decision: { kind: "availability", targetId: row.id },
                })),
        },
    ]
    return { ...context, sections }
}

const createShiftsRequestsActions = (context: ReturnType<typeof createShiftsRequestsSections>) => {
    const { t, leaves, swaps, name, span, statusOf, sections } = context
    const recent = [
        ...leaves
            .filter((leave) => leave.status !== "pending")
            .map((leave) => ({
                id: leave.id,
                at: leave.createdAt,
                title: `${name(leave.staffId)} · ${t("kindLeave")} ${span(leave.from, leave.to)}`,
                status: leave.status,
                item: leave.item,
            })),
        ...swaps
            .filter((swap) => swap.status !== "pending")
            .map((swap) => ({
                id: swap.id,
                at: swap.createdAt,
                title: `${name(swap.toStaffId)} · ${t(swap.kind === "claim" ? "kindClaim" : "kindSwap")} ${swap.shiftLine}`,
                status: swap.status,
                item: swap.item,
            })),
    ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, RECENT_LIMIT)
        .map((entry) => ({
            id: entry.id,
            title: entry.title,
            notes: [],
            ...statusOf(entry.status, entry.item),
            decision: null,
        }))
    const openSections = sections.filter((section) => section.rows.length > 0)

    return { ...context, recent, openSections }
}
/** The leave, swap and availability requests of the staff with approve and decline, through the back end GraphQL API. */
export const useShiftsRequestsView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const bench = input.bench.data
    const format = useShiftsFormat()
    const actions = useShiftsRequestsActions(input)
    const busy = actions.isBusy
    const state: ShiftsRequestsControllerInput = { t, bench, format, busy }
    const copy: ShiftsRequestViews["requestsCopy"]["requests"] = {
        emptyTitle: t("reqNoneTitle"),
        emptyBody: t("reqNoneBody"),
        recentTitle: t("reqRecent"),
        approveLabel: t("approve"),
        declineLabel: t("decline"),
        isBusy: busy,
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }
    const view = createShiftsRequestsActions(
        createShiftsRequestsSections(createShiftsRequestsRows({ ...state, bench })),
    )
    return { copy, data: { sections: view.openSections, recent: view.recent }, on: actions.on }
}

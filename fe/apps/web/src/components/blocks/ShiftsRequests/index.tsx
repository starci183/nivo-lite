"use client"

import { ShiftsRequestsBase, type RequestRowView, type RequestSectionView } from "./component"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsRequestCommands } from "@/hooks/shiftsCommands"
import type { ShiftsWorkItemView } from "@/modules/types"

/** State values and commands consumed by the connected surface. */
type ShiftsRequestsControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly commands: ReturnType<typeof useShiftsRequestCommands>
    readonly busy: boolean
    readonly setBusy: React.Dispatch<React.SetStateAction<boolean>>
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
    const itemRow = (
        id: string,
        title: string,
        notes: ReadonlyArray<string>,
        status: string,
        item: ShiftsWorkItemView | null,
    ): RequestRowView => ({
        id,
        title,
        notes: notes.filter((note) => note !== ""),
        ...statusOf(status, item),
        decision: item?.status === "waiting_decision" ? { kind: "item", targetId: item.id } : null,
    })
    const leaveTitle = (from: string, to: string, staffId: string): string => {
        const end = to === from ? "" : ` - ${format.dayMonth(to)}`
        return `${name(staffId)}: ${format.dayFull(from)}${end}`
    }
    const swapTitle = (kind: string, from: string | null, to: string, shiftLine: string): string =>
        kind === "claim"
            ? t("claimLine", { name: name(to), shift: shiftLine })
            : t("swapLine", { from: name(from), to: name(to), shift: shiftLine })
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
                    itemRow(
                        leave.id,
                        leaveTitle(leave.from, leave.to, leave.staffId),
                        [leave.reason, leave.item?.summary ?? ""],
                        leave.status,
                        leave.item,
                    ),
                ),
        },
        {
            id: "swap",
            title: t("reqSwap"),
            hint: t("reqSwapHint"),
            rows: swaps
                .filter((swap) => swap.status === "pending")
                .map((swap) =>
                    itemRow(
                        swap.id,
                        swapTitle(swap.kind, swap.fromStaffId, swap.toStaffId, swap.shiftLine),
                        [swap.checks.length > 0 ? `${t("outsideRules")}: ${swap.checks.join(" ")}` : "", swap.reason],
                        swap.status,
                        swap.item,
                    ),
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
    const { t, commands, setBusy, leaves, swaps, name, span, statusOf, sections } = context
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

    const run = async (job: () => Promise<boolean>): Promise<void> => {
        setBusy(true)
        await job()
        setBusy(false)
    }
    const decide = (kind: "item" | "availability", targetId: string, approve: boolean): Promise<void> => {
        const status = approve ? "approved" : "rejected"
        return run(() =>
            kind === "item" ? commands.decideItem(targetId, status) : commands.decideAvailability(targetId, approve),
        )
    }
    return { ...context, recent, openSections, decide }
}

const renderShiftsRequests = (
    context: ReturnType<typeof createShiftsRequestsActions>,
): React.ComponentProps<typeof ShiftsRequestsBase> => {
    const { t, busy, openSections, decide, recent } = context
    return {
        props: {
            emptyTitle: t("reqNoneTitle"),
            emptyBody: t("reqNoneBody"),
            recentTitle: t("reqRecent"),
            approveLabel: t("approve"),
            declineLabel: t("decline"),
            sections: openSections,
            recent,
            isBusy: busy,
        },
        on: {
            approve: (kind, targetId) => void decide(kind, targetId, true),
            decline: (kind, targetId) => void decide(kind, targetId, false),
        },
    }
}

/** The leave, swap and availability requests of the staff with approve and decline, through the back end GraphQL API. */
export const ShiftsRequests = () => {
    const t = useTranslations("shifts")
    const bench = useShiftsBenchData(null).data
    const format = useShiftsFormat()
    const commands = useShiftsRequestCommands()
    const [busy, setBusy] = useState(false)
    const state: ShiftsRequestsControllerInput = { t, bench, format, commands, busy, setBusy }
    if (bench === undefined || bench.role === "staff") return null
    const view = createShiftsRequestsActions(
        createShiftsRequestsSections(createShiftsRequestsRows({ ...state, bench })),
    )
    return <ShiftsRequestsBase {...renderShiftsRequests(view)} />
}

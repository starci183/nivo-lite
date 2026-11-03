"use client"

import { useTranslations } from "next-intl"
import { useAppSelector } from "@/redux"
import { useAgentWorkbenchShell } from "@/hooks/agentDashboard"
import { useBookingBoard } from "@/hooks/bookingBoard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { BOOKING_TABS } from "@/modules/types"
import { useBookingSetupView } from "./useBookingSetupView"
import { useBookingDeskView } from "./useBookingDeskView"
import { useBookingFiguresView } from "./useBookingFiguresView"
import { useBookingWaitlistView } from "./useBookingWaitlistView"
import { useBookingStatsView } from "./useBookingStatsView"

type BookingTab = (typeof BOOKING_TABS)[number]

/** The required installation and route tab, with all five tab names resolved by the server page. */
interface BookingWorkbenchViewInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<BookingTab, string>>
}

/** Owns the booking workbench's real read scopes and the exact lifetimes of its former conditional tab panels. */
export const useBookingWorkbenchView = (input: BookingWorkbenchViewInput) => {
    const t = useTranslations("workbenchBooking")
    const labels = useSlotLabels()
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const {
        tabs,
        dashboard: frame,
        isNormal: overview,
        frameOf,
    } = useAgentWorkbenchShell({
        module: "booking",
        installationId: input.installationId,
        ids: BOOKING_TABS,
        initialTab: input.initialTab,
    })
    const board = useBookingBoard(overview)
    const deskActive = overview && (tabs.selected === "calendar" || tabs.selected === "today")
    const setupActive = overview && tabs.selected === "setup"
    const ribbon = useBookingFiguresView(board)
    const desk = useBookingDeskView({ mode: tabs.selected === "today" ? "today" : "week", isActive: deskActive, scope })
    const waitlist = useBookingWaitlistView(overview && tabs.selected === "waitlist", scope, board)
    const stats = useBookingStatsView(board)
    const setup = useBookingSetupView(setupActive, scope, board)
    const panel = { waitlist: waitlist.props, stats: stats.props, setup: setup.props } as const
    return {
        shape: overview ? tabs.selected : ("explanation" as const),
        props: {
            ...frameOf(input.tabs),
            ribbon: ribbon.props,
            desk: desk.props,
            panel: {
                slot: mapSlot(board.boardSlot, () => panel),
                placeholder: panel,
                labels: labels(t("loadFailedTitle")),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retryPanel: board.reload,
            retryRibbon: ribbon.on.retry,
            retryDesk: desk.on.retry,
            desk: {
                onAdd: desk.on.add,
                onPlacementChange: desk.on.placementChange,
                onPlacementSubmit: desk.on.placementSubmit,
                onPlacementClose: desk.on.placementClose,
                onPrev: desk.on.prev,
                onNext: desk.on.next,
                onThisWeek: desk.on.thisWeek,
                onPickDate: desk.on.pickDate,
                onToggleCancelled: desk.on.toggleCancelled,
                onDismissNotice: desk.on.dismissNotice,
                onOpen: desk.on.open,
                onAct: desk.on.act,
                onConfirmCancel: desk.on.confirmCancel,
                onKeepBooking: desk.on.keepBooking,
                onDetailAction: desk.on.detailAction,
                onCloseDetail: desk.on.closeDetail,
            },
            setup: setup.on,
            waitlist: { onRemove: waitlist.on.remove },
        },
    } as const
}

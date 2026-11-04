"use client"

import { useTranslations } from "next-intl"
import { useAppSelector } from "@/redux"
import { useAgentWorkbenchShell, type AgentWorkbenchFrame } from "@/hooks/agentDashboard"
import { useBookingBoard } from "@/hooks/bookingBoard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { BOOKING_TABS, type DataSlot, type SlotLabels } from "@/modules/types"
import { useBookingSetupView, type BookingSetupView } from "./useBookingSetupView"
import { useBookingDeskView, type BookingDeskView } from "./useBookingDeskView"
import { useBookingFiguresView, type BookingFiguresViewShape } from "./useBookingFiguresView"
import { useBookingWaitlistView, type BookingWaitlistView } from "./useBookingWaitlistView"
import { useBookingStatsView, type BookingStatsViewShape } from "./useBookingStatsView"
import type { PlacementFields } from "@/hooks/bookingDesk"
import type { WorkbenchAsideActions } from "@/modules/types"

type BookingTab = (typeof BOOKING_TABS)[number]

/** The required installation and route tab, with all five tab names resolved by the server page. */
interface BookingWorkbenchViewInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<BookingTab, string>>
}

/** The props of the three panels of the booking workbench, each as the hook that owns it draws them. */
export interface BookingPanelProps {
    readonly waitlist: BookingWaitlistView["props"]
    readonly stats: BookingStatsViewShape["props"]
    readonly setup: BookingSetupView["props"]
}

/** The props of the workbench: the frame, the ribbon, the desk and the panels. */
export interface BookingWorkbenchProps extends AgentWorkbenchFrame<BookingTab> {
    readonly ribbon: BookingFiguresViewShape["props"]
    readonly desk: BookingDeskView["props"]
    readonly panel: {
        readonly slot: DataSlot<BookingPanelProps>
        readonly placeholder: BookingPanelProps
        readonly labels: SlotLabels
    }
}

/** The commands of the workbench: the tab and the retries, then those of the desk, the setup and the waitlist. */
export interface BookingWorkbenchOn {
    readonly aside: WorkbenchAsideActions
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryPanel: ReturnType<typeof useBookingBoard>["reload"]
    readonly retryRibbon: BookingFiguresViewShape["on"]["retry"]
    readonly retryDesk: BookingDeskView["on"]["retry"]
    readonly desk: {
        readonly onAdd: () => unknown
        readonly onPlacementChange: (patch: Partial<PlacementFields>) => void
        readonly onPlacementSubmit: () => void
        readonly onPlacementClose: () => void
        readonly onPrev: () => void
        readonly onNext: () => void
        readonly onThisWeek: () => void
        readonly onPickDate: (date: string) => void
        readonly onToggleCancelled: (value: boolean) => void
        readonly onDismissNotice: () => void
        readonly onOpen: (id: string) => void
        readonly onAct: (id: string, action: string) => void
        readonly onConfirmCancel: () => void
        readonly onKeepBooking: () => void
        readonly onDetailAction: (action: string) => void
        readonly onCloseDetail: () => void
    }
    readonly setup: BookingSetupView["on"]
    readonly waitlist: {
        readonly onRemove: (id: string) => void
    }
}

/** The view `useBookingWorkbenchView` returns. */
export interface BookingWorkbenchView {
    readonly shape: BookingTab
    readonly props: BookingWorkbenchProps
    readonly on: BookingWorkbenchOn
}

/** Owns the booking workbench's real read scopes and the exact lifetimes of its former conditional tab panels. */
export const useBookingWorkbenchView = (input: BookingWorkbenchViewInput): BookingWorkbenchView => {
    const t = useTranslations("workbenchBooking")
    const labels = useSlotLabels()
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const {
        tabs,
        dashboard: frame,
        asideOn,
        frameOf,
    } = useAgentWorkbenchShell({
        module: "booking",
        installationId: input.installationId,
        ids: BOOKING_TABS,
        initialTab: input.initialTab,
    })
    const board = useBookingBoard(true)
    const deskActive = tabs.selected === "calendar" || tabs.selected === "today"
    const setupActive = tabs.selected === "setup"
    const ribbon = useBookingFiguresView(board)
    const desk = useBookingDeskView({ mode: tabs.selected === "today" ? "today" : "week", isActive: deskActive, scope })
    const waitlist = useBookingWaitlistView(tabs.selected === "waitlist", scope, board)
    const stats = useBookingStatsView(board)
    const setup = useBookingSetupView(setupActive, scope, board)
    const panel = { waitlist: waitlist.props, stats: stats.props, setup: setup.props } as const
    return {
        shape: tabs.selected,
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
            aside: asideOn,
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

"use client"
import { useContentCalendarPanelView } from "./useContentCalendarPanelView"
import { useContentListPanelView } from "./useContentListPanelView"
import { useContentQueuePanelView } from "./useContentQueuePanelView"
import { useContentBalancePanelView } from "./useContentBalancePanelView"
import type { ContentSelectedViewInput } from "./contentWorkbench.shared"

/** Owns the four mutually exclusive panel controllers without retaining inactive drafts or drag state. */
export const useContentPanelViews = (input: ContentSelectedViewInput) => {
    const calendar = useContentCalendarPanelView({
        ...input,
        isActive: input.isActive && input.selected === "calendar",
    })
    const list = useContentListPanelView({ ...input, isActive: input.isActive && input.selected === "list" })
    const queue = useContentQueuePanelView({ ...input, isActive: input.isActive && input.selected === "queue" })
    const balance = useContentBalancePanelView({ ...input, isActive: input.isActive && input.selected === "balance" })
    return {
        props:
            calendar.props !== undefined &&
            list.props !== undefined &&
            queue.props !== undefined &&
            balance.props !== undefined
                ? { calendar: calendar.props, list: list.props, queue: queue.props, balance: balance.props }
                : undefined,
        loading: { calendar: calendar.loading, balance: balance.loading },
        on: { calendar: calendar.on, list: list.on, queue: queue.on, balance: balance.on },
    }
}

"use client"

import { useSyncExternalStore } from "react"
import { railCollapsedOf, rememberRailCollapsed, subscribeRailCollapsed } from "@/modules/storage"

/** The collapsed state of the console rail and the command that changes it. */
type RailCollapse = {
    readonly isCollapsed: boolean
    readonly setCollapsed: (collapsed: boolean) => void
}

/** The rail's collapsed state, remembered per person in the browser; expanded on the server and until hydration. */
export const useRailCollapsed = (userId: string): RailCollapse => ({
    isCollapsed: useSyncExternalStore(
        subscribeRailCollapsed,
        () => railCollapsedOf(userId),
        () => false,
    ),
    setCollapsed: (collapsed) => rememberRailCollapsed(userId, collapsed),
})

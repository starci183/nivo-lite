"use client"

import { useState } from "react"

/** The ordered real tabs and the selection supplied by the route. */
interface AgentWorkbenchTabsInput<T extends string> {
    readonly ids: readonly [T, ...T[]]
    readonly initialTab: string | null
    /** A separate editor replaces the tabbed workbench and starts a fresh selection when it returns. */
    readonly isActive?: boolean
    /** The actual workspace/installation identity when its owner can change without a route remount. */
    readonly scope?: string
}

const selectedTabOf = <T extends string>(ids: readonly [T, ...T[]], value: string | null): T =>
    ids.find((id) => id === value) ?? ids[0]

/** Owns local selection and soft URL replacement without dropping any other query parameter. */
export const useAgentWorkbenchTabs = <T extends string>(
    input: AgentWorkbenchTabsInput<T>,
): {
    selected: T
    select: (id: string) => void
} => {
    const isActive = input.isActive ?? true
    const [selected, setSelected] = useState<T>(() => selectedTabOf(input.ids, input.initialTab))
    const [route, setRoute] = useState({ tab: input.initialTab, isActive, scope: input.scope })
    if (input.initialTab !== route.tab || isActive !== route.isActive || input.scope !== route.scope) {
        setRoute({ tab: input.initialTab, isActive, scope: input.scope })
        setSelected(selectedTabOf(input.ids, input.initialTab))
    }
    const select = (id: string) => {
        if (!isActive) return
        setSelected(selectedTabOf(input.ids, id))
        const query = new URLSearchParams(window.location.search)
        query.set("tab", id)
        window.history.replaceState(null, "", `?${query.toString()}`)
    }
    return { selected, select }
}

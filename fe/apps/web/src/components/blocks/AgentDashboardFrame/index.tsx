"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useAgentDashboardFrame } from "@/hooks/agentDashboard"
import type { ModuleKey } from "@/hooks/installations"
import type { WorkbenchSurface } from "@/modules/types"
import { AgentDashboardFrameBase } from "./component"

/** One area of the module under the strip. */
interface AgentDashboardTab {
    readonly id: string
    readonly label: string
    /** The tab's content; omit only while loading. */
    readonly content?: ReactNode
}

/** What a module hands the frame: the module, its instance, its own slots and tabs. The common regions are read here. */
interface AgentDashboardFrameProps {
    readonly module: ModuleKey
    /** The instance whose dashboard this is; null for the first installation of the type. */
    readonly installationId?: string | null
    /** The module's own tabs are not known yet: a tab without content draws a skeleton card. */
    readonly hasPlaceholder?: boolean
    /** The page command in the header: omit for "Talk to the agent", null for none. */
    readonly command?: ReactNode | null
    /** The module's own connected figures block (its four stat items), drawn under the heading. */
    readonly ribbon?: ReactNode
    /** The module's own waiting card in place of the dashboard's "waiting for you" region; a function draws it for the surface it stands on (a card, or a list in the pane the why pane opens). */
    readonly waiting?: ReactNode | ((surface: WorkbenchSurface) => ReactNode)
    /** The decision of one work item, drawn in the footer of the why pane: the same mutation as its row, with `intent="commit"`. */
    readonly whyDecision?: (workItemId: string) => ReactNode
    /** A module's own gaps card in place of the built-in one; null shows none. */
    readonly gaps?: ReactNode
    readonly tabs: ReadonlyArray<AgentDashboardTab>
    /** Layers the module opens over the workbench (an editor, a drawer); drawn inside the page body. */
    readonly children?: ReactNode
    /** The tab whose label carries the number of decisions waiting for a person. */
    readonly waitingTab?: string
    /** The tab id from ?tab=; unknown ids open the first tab. A new value (a link to another tab) selects it. */
    readonly initialTab?: string | null
    /** Controlled selection, for a module whose panels switch tabs themselves. */
    readonly tab?: string
    readonly onTabChange?: (id: string) => void
}

const resolveTab = (tabs: ReadonlyArray<AgentDashboardTab>, id: string | null | undefined): string =>
    (tabs.find((tab) => tab.id === id) ?? tabs[0])?.id ?? ""

/** The shared anatomy of every agent workbench, connected: reads the dashboard of the module (waiting, done, connections, knowledge) in the browser. */
export const AgentDashboardFrame = (props: AgentDashboardFrameProps) => {
    const frame = useAgentDashboardFrame({
        module: props.module,
        installationId: props.installationId ?? null,
        hasOwnGaps: props.gaps !== undefined,
    })
    const [own, setOwn] = useState<string>(() => resolveTab(props.tabs, props.initialTab))
    const [routeTab, setRouteTab] = useState(props.initialTab ?? null)
    if ((props.initialTab ?? null) !== routeTab) {
        setRouteTab(props.initialTab ?? null)
        setOwn(resolveTab(props.tabs, props.initialTab))
    }
    const selected = resolveTab(props.tabs, props.tab ?? own)

    const select = (id: string) => {
        if (props.tab === undefined) setOwn(resolveTab(props.tabs, id))
        props.onTabChange?.(id)
        const query = new URLSearchParams(window.location.search)
        query.set("tab", id)
        window.history.replaceState(null, "", `?${query.toString()}`)
    }

    return (
        <AgentDashboardFrameBase
            shape={{
                command: props.command ?? null,
                ribbon: props.ribbon ?? null,
                waiting: props.waiting ?? null,
                whyDecision: props.whyDecision ?? null,
                gaps: props.gaps ?? null,
                overlay: props.children ?? null,
                panel: props.tabs.find((tab) => tab.id === selected)?.content ?? null,
            }}
            props={{
                band: frame.band,
                why: frame.why,
                ...frame.regions,
                hasPlaceholder: props.hasPlaceholder === true,
                tabsLabel: frame.tabsLabel,
                tabs: props.tabs.map((tab) => ({ id: tab.id, label: frame.tabLabel(tab, props.waitingTab) })),
                selectedTab: selected,
            }}
            on={{ selectTab: select, retry: frame.reload, closeWhy: frame.closeWhy }}
        />
    )
}

"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { useAgentDashboardFrame } from "@/hooks/agentDashboard"
import type { ModuleKey } from "@/hooks/installations"
import { AgentDashboardFrameBase } from "./component"

/** One area of the module under the strip. */
interface AgentDashboardTab {
    readonly id: string
    readonly label: string
    /** The tab's content; omit only while loading. */
    readonly content?: ReactNode
}

/** What a module hands the frame: the module, its instance, its own figures and tabs. The common regions are read here. */
interface AgentDashboardFrameProps {
    readonly module: ModuleKey
    /** The instance whose dashboard this is; null for the first installation of the type. */
    readonly installationId?: string | null
    /** The module's own figures and tabs are not known yet. */
    readonly isLoading?: boolean
    /** The page command in the header: omit for "Talk to the agent", null for none. */
    readonly command?: ReactNode | null
    /** Exactly 4 stat-strip items. */
    readonly figures: ReadonlyArray<DescriptionListStatItem>
    readonly figuresFailed?: boolean
    readonly tabs: ReadonlyArray<AgentDashboardTab>
    /** The tab id from ?tab=; unknown ids open the first tab. */
    readonly initialTab?: string | null
    /** Controlled selection, for a module whose panels switch tabs themselves. */
    readonly tab?: string
    readonly onTabChange?: (id: string) => void
    /** A module's own gaps card in place of the built-in one; null shows none. */
    readonly gaps?: ReactNode
}

const resolveTab = (tabs: ReadonlyArray<AgentDashboardTab>, id: string | null | undefined): string =>
    (tabs.find((tab) => tab.id === id) ?? tabs[0])?.id ?? ""

/** The shared anatomy of every agent workbench, connected: reads the dashboard of the module (waiting, done, connections, knowledge) in the browser. */
export const AgentDashboardFrame = (props: AgentDashboardFrameProps) => {
    const frame = useAgentDashboardFrame({
        module: props.module,
        installationId: props.installationId ?? null,
        isLoading: props.isLoading === true,
        figures: props.figures,
        figuresFailed: props.figuresFailed === true,
        hasOwnCommand: props.command !== undefined,
        hasOwnGaps: props.gaps !== undefined,
    })
    const [own, setOwn] = useState<string>(() => resolveTab(props.tabs, props.initialTab))
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
            state={{
                command: props.command ?? null,
                gaps: props.gaps ?? null,
                panel: props.tabs.find((tab) => tab.id === selected)?.content ?? null,
            }}
            props={{
                ...frame.head,
                ...frame.view,
                hasPlaceholder: props.isLoading === true,
                tabsLabel: frame.tabsLabel,
                tabs: props.tabs.map((tab) => ({ id: tab.id, label: tab.label })),
                selectedTab: selected,
            }}
            on={{ selectTab: select, retry: frame.reload }}
        />
    )
}

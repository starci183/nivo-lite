"use client"

import type { ModuleKey } from "@/hooks/installations"
import { useWorkbenchAside } from "@/hooks/workbench"
import type { WorkbenchAsideActions, WorkbenchAsideView } from "@/modules/types"
import { useAgentDashboardFrame, type AgentDashboardFrameView } from "./useAgentDashboardFrame"
import { useAgentWorkbenchTabs } from "./useAgentWorkbenchTabs"

/** The module, its instance and tabs of a workbench; the scope tells one workspace and instance from another when it can change. */
interface AgentWorkbenchShellInput<T extends string> {
    readonly module: ModuleKey
    readonly installationId: string | null
    readonly ids: readonly [T, ...T[]]
    readonly initialTab: string | null
    readonly scope?: string
}

/** The frame of one view: the explanation of a decision, the dashboard regions and the strip of tabs with the chosen one. */
export interface AgentWorkbenchFrame<T extends string> extends Pick<
    AgentDashboardFrameView,
    "why" | "regions" | "tabsLabel"
> {
    /** The side pane's arrangement and words. */
    aside: WorkbenchAsideView
    selectedTab: T
    tabs: {
        id: T
        label: string
    }[]
}

/** What the shell hands a workbench: the tabs, the dashboard frame and the frame of each view. */
export interface AgentWorkbenchShell<T extends string> {
    tabs: {
        selected: T
        select: (id: string) => void
    }
    dashboard: AgentDashboardFrameView
    /** The commands that open and close the side pane. */
    asideOn: WorkbenchAsideActions
    isNormal: boolean
    frameOf: (labels: Readonly<Record<T, string>>) => AgentWorkbenchFrame<T>
}

/** The tabs and the dashboard frame every workbench stands on, and whether the workbench shows its normal panels (no decision explained). */
export const useAgentWorkbenchShell = <T extends string>(
    input: AgentWorkbenchShellInput<T>,
): AgentWorkbenchShell<T> => {
    const tabs = useAgentWorkbenchTabs({
        ids: input.ids,
        initialTab: input.initialTab,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
    })
    const dashboard = useAgentDashboardFrame({
        module: input.module,
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const aside = useWorkbenchAside(dashboard.why.workItemId !== null)
    return {
        tabs,
        dashboard,
        asideOn: aside.on,
        isNormal: dashboard.why.workItemId === null,
        /** The frame of the view: the explanation of a decision, the dashboard regions and the strip of tabs with the chosen one. */
        frameOf: (labels: Readonly<Record<T, string>>) => ({
            aside: aside.view,
            why: dashboard.why,
            regions: dashboard.regions,
            tabsLabel: dashboard.tabsLabel,
            selectedTab: tabs.selected,
            tabs: input.ids.map((id) => ({ id, label: labels[id] })),
        }),
    }
}

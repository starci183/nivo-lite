"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useContentRibbon, useContentWorkbench } from "@/hooks/content"
import { useWorkspaceId } from "@/hooks/workspaces"
import { mapSlot, useSlotLabels } from "@/hooks/slot"

import { CONTENT_TABS, type ContentAssembly, type ContentViews } from "@/modules/types"

import { useContentWorkbenchCopy } from "./useContentWorkbenchCopy"
import { useContentPanelViews } from "./useContentPanelViews"
import { useContentSettingsViews } from "./useContentSettingsViews"
import { useContentCommandViews } from "./useContentCommandViews"
import { useContentPostEditorView } from "./useContentPostEditorView"

interface ContentWorkbenchViewInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly focus: string | null
    readonly tabs: Readonly<Record<ContentViews["tab"], string>>
}

/** Owns Content's real reads, conditional panel controllers and resolved words as one atomic world. */
export const useContentWorkbenchView = (input: ContentWorkbenchViewInput): ContentAssembly["workbenchView"] => {
    const t = useTranslations("content")
    const dashboard = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const copy = useContentWorkbenchCopy()
    const workspaceId = useWorkspaceId()
    const [startedAt] = useState(() => new Date().toISOString())
    const tabs = useAgentWorkbenchTabs({ ids: CONTENT_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({ module: "content", installationId: input.installationId, hasOwnGaps: false })
    const isActive = frame.why.workItemId === null
    const workbench = useContentWorkbench(isActive)
    const data = workbench.data
    const owner = {
        data,
        workspaceId: workspaceId,
        startedAt,
        copy,
        isActive,
        isReady: workbench.data !== undefined,
        scope: JSON.stringify([workspaceId, input.installationId]),
        focus: input.focus,
        selected: tabs.selected,
    }
    const panels = useContentPanelViews(owner)
    const settings = useContentSettingsViews(owner)
    const commands = useContentCommandViews(owner)
    const editor = useContentPostEditorView(owner)
    const figures = useContentRibbon(data?.figures ?? undefined)
    const panel =
        data !== undefined && panels.props !== undefined && settings.props !== undefined && commands.props !== undefined
            ? {
                  canManage: data.canManage,
                  copy,
                  readOnly: t("readOnly"),
                  panels: panels.props,
                  settings: settings.props,
                  commands: commands.props,
              }
            : undefined
    const panelSlot = mapSlot(workbench.slot, () => {
        if (panel === undefined) throw new Error("Content panel projection missing for a ready read")
        return panel
    })
    const shape: ContentViews["tab"] | "explanation" = isActive ? tabs.selected : "explanation"
    const ribbonSlot = mapSlot(workbench.slot, () => figures)
    return {
        shape,
        props: {
            copy,
            loading: panels.loading,
            why: frame.why,
            regions: frame.regions,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: contentTabsOf(frame, input.tabs),
            ribbon: {
                label: dashboard("ribbonAria"),
                slot: ribbonSlot,
                placeholder: figures,
                labels: slotLabels(t("loadFailedTitle")),
            },
            panel: {
                slot: panelSlot,
                labels: { ...slotLabels(t("loadFailedTitle")), error: t("loadFailedTitle") },
                errorDescription: t("loadFailedBody"),
            },
            editor: editor.props,
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.reload,
            panels: panels.on,
            settings: settings.on,
            commands: commands.on,
            editor: editor.on,
        },
    }
}

/** Applies the original queue decision count to the five resolved strip labels. */
const contentTabsOf = (
    frame: ReturnType<typeof useAgentDashboardFrame>,
    tabs: Readonly<Record<ContentViews["tab"], string>>,
) => CONTENT_TABS.map((id) => ({ id, label: frame.tabLabel({ id, label: tabs[id] }, "queue") }))

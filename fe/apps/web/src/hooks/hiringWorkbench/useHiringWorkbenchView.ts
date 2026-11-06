"use client"
import { HIRING_TABS, type HiringAssembly, type HiringViews } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useHiringWorkbench } from "@/hooks/hiring"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useGraphQLWithToast } from "@/modules/toast"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"

import { useHiringWorkbenchCopy } from "./useHiringWorkbenchCopy"
import { useHiringBoardViews } from "./useHiringBoardViews"
import { useHiringSettingsViews } from "./useHiringSettingsViews"
import { useHiringCandidateView } from "./useHiringCandidateView"

interface HiringWorkbenchInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly focus: string | null
    readonly tabs: Readonly<Record<HiringViews["tab"], string>>
}

/** The same four factual numbers and original localized terms/meta of the Hiring ribbon. */
const figuresOf = (board: HiringWorkbenchData, t: ReturnType<typeof useTranslations<"workbenchFigures">>) => {
    const figures = board.figures
    return [
        {
            id: "roles",
            term: t("hrRoles"),
            value: String(figures.openRoles),
            meta: t("hrRolesMeta", { n: figures.totalRoles }),
        },
        { id: "pipeline", term: t("hrPipeline"), value: String(figures.pipeline), meta: t("hrPipelineMeta") },
        {
            id: "interviews",
            term: t("hrInterviews"),
            value: String(figures.interviewsWeek),
            meta: t("hrInterviewsMeta"),
        },
        {
            id: "offers",
            term: t("hrOffers"),
            value: String(figures.offersWaiting + figures.offersSent),
            meta: t("hrOffersMeta", { waiting: figures.offersWaiting, sent: figures.offersSent }),
        },
    ]
}

/** One Hiring world resolves its board, tab lifetimes, independent dashboard reads and candidate detail. */
export const useHiringWorkbenchView = (input: HiringWorkbenchInput): HiringAssembly["workbenchView"] => {
    const t = useTranslations("workbenchFigures")
    const labels = useSlotLabels()
    const runGraphQL = useGraphQLWithToast()
    const copy = useHiringWorkbenchCopy()
    const workspaceId = useWorkspaceId()
    const scope = JSON.stringify([workspaceId, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: HIRING_TABS, initialTab: input.initialTab, scope })
    const frame = useAgentDashboardFrame({ module: "hiring", installationId: input.installationId, hasOwnGaps: false })
    const isActive = frame.why.workItemId === null
    const board = useHiringWorkbench(isActive)
    const owner = {
        board: board.board,
        copy,
        isActive,
        isReady: board.hasBoard,
        scope,
        focus: input.focus,
        selected: tabs.selected,
    }
    const panels = useHiringBoardViews(owner)
    const settings = useHiringSettingsViews(owner)
    const candidate = useHiringCandidateView(owner)
    const items = figuresOf(board.board, t)
    const data = { panels: panels.props, settings: settings.props }
    const shape: HiringViews["tab"] | "explanation" = isActive ? tabs.selected : "explanation"
    return {
        shape,
        props: {
            why: frame.why,
            regions: frame.regions,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: HIRING_TABS.map((id) => ({ id, label: input.tabs[id] })),
            ribbon: {
                label: t("hrTabJobs"),
                slot: mapSlot(board.slot, () => items),
                placeholder: items,
                labels: { ...labels(t("hrFailedTitle")), forbidden: t("hrForbiddenTitle"), error: t("hrFailedTitle") },
            },
            panel: { slot: mapSlot(board.slot, () => data), placeholder: data, labels: labels(t("hrFailedTitle")) },
            candidate: candidate.props,
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: () => {
                board
                    .reload()
                    .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
            },
            panels: panels.on,
            settings: settings.on,
            candidate: candidate.on,
        },
    }
}

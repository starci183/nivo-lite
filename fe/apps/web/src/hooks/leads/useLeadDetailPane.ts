"use client"

import { useTranslations } from "next-intl"
import { isWaitingOf } from "@/hooks/slot"
import { useState } from "react"
import type { LeadDetailPaneOn, LeadDetailPaneView } from "@/modules/types"
import { useLeadApprovalPane } from "./useLeadApprovalPane"
import { useLeadContextPane } from "./useLeadContextPane"
import { useLeadFlowPane } from "./useLeadFlowPane"
import { useLeadHeadPane } from "./useLeadHeadPane"
import { useLeadOutcomePane } from "./useLeadOutcomePane"
import { useLeadStepPane } from "./useLeadStepPane"
import { useLeadTimelinePane } from "./useLeadTimelinePane"

/** What the panes of one open lead draw and the commands they run. */
export interface LeadDetailPaneState {
    readonly view: LeadDetailPaneView
    readonly on: LeadDetailPaneOn
}

/** The open lead as its panes need it: head, approval, activity, and the aside regions, with the aside's shown state and its drawer. */
export const useLeadDetailPane = (leadId: string | undefined, isListLoading: boolean): LeadDetailPaneState => {
    const t = useTranslations("leads")
    const tl = useTranslations("lead")
    const [isInfoOpen, setInfoOpen] = useState(true)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const head = useLeadHeadPane(leadId)
    const approval = useLeadApprovalPane(leadId)
    const timeline = useLeadTimelinePane(leadId)
    const step = useLeadStepPane(leadId)
    const context = useLeadContextPane(leadId)
    const outcome = useLeadOutcomePane(leadId)
    const flow = useLeadFlowPane(leadId)
    const slots = [head, approval, timeline, step, context, outcome, flow].map((region) => region.pane.slot)
    const isLoading = isListLoading || isWaitingOf(...slots)
    const resting = { isLoading: true } as const
    return {
        view: {
            isLoading,
            head: isLoading ? { ...head.pane, slot: resting } : head.pane,
            headLabels: head.labels,
            approval: isLoading ? { ...approval.pane, slot: resting } : approval.pane,
            timeline: isLoading ? { ...timeline.pane, slot: resting } : timeline.pane,
            step: isLoading ? { ...step.pane, slot: resting } : step.pane,
            context: isLoading ? { ...context.pane, slot: resting } : context.pane,
            hasBrief: context.hasBrief,
            outcome: isLoading ? { ...outcome.pane, slot: resting } : outcome.pane,
            flow: isLoading ? { ...flow.pane, slot: resting } : flow.pane,
            isInfoOpen,
            isDrawerOpen,
            copy: {
                infoTitle: t("asideLabel"),
                infoClose: t("infoClose"),
                flowNone: tl("flowNone"),
                noticeTitle: tl("noticeTitle"),
            },
        },
        on: {
            draft: head.on.draft,
            refresh: head.on.refresh,
            copy: head.on.copy,
            copyBrief: context.on.copy,
            toggleInfo: () => {
                setInfoOpen((open) => !open)
                setDrawerOpen((open) => !open)
            },
            drawer: setDrawerOpen,
            approvalToggleEdit: approval.on.toggleEdit,
            approvalEditChange: approval.on.editChange,
            approvalDecide: approval.on.decide,
            timelineRetry: timeline.on.retry,
            timelineToggle: timeline.on.toggle,
            stepPropose: step.on.propose,
            stepOpen: step.on.open,
            stepClose: step.on.close,
            stepChange: step.on.change,
            stepChangeDue: step.on.changeDue,
            stepSubmit: step.on.submit,
            contextRefresh: context.on.refresh,
            outcomeOpen: outcome.on.open,
            outcomeClose: outcome.on.close,
            outcomeStage: outcome.on.stage,
            outcomeEvidence: outcome.on.evidence,
            outcomeSubmit: outcome.on.submit,
            flowRetry: flow.on.retry,
        },
    }
}

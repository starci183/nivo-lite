"use client"

import { useTranslations } from "next-intl"
import { useWorkflowVersion } from "@/hooks/agentWorkflowPages"
import { useSlotLabels } from "@/hooks/slot"
import { EMPTY_STEPS_MAP } from "@/hooks/workflowSteps"
import type { PaneGridLayout, WorkflowDiffReadView } from "@/modules/types"
import { AgentWorkflowVersionBase } from "./component"

/** The version whose page this is: the workflow by its key, and the version by its number. */
type AgentWorkflowVersionProps = {
    readonly installationId: string
    readonly workflowKey: string
    readonly number: number
}

const GRID: PaneGridLayout = {
    areas: { base: ["main"] },
    columns: { base: ["fill"] },
    rows: { base: ["fill"] },
}

const PLACEHOLDER: WorkflowDiffReadView = {
    title: "-",
    view: { first: "", summary: "-", steps: [], grants: [], flow: EMPTY_STEPS_MAP },
}

/** The connected page of one version of a workflow: reads it against the version before and draws it in cards. */
export const AgentWorkflowVersion = (props: AgentWorkflowVersionProps) => {
    const t = useTranslations("agentWorkflowPages")
    const td = useTranslations("agentWorkflows")
    const slotLabels = useSlotLabels()
    const page = useWorkflowVersion(props.installationId, props.workflowKey, props.number)
    return (
        <AgentWorkflowVersionBase
            props={{
                paneLabel: t("paneLabel"),
                cards: {
                    stepsTitle: td("diffStepsTitle"),
                    grantsTitle: td("diffGrantsTitle"),
                    mapTitle: td("diffMapTitle"),
                    mapLabel: td("graphLabel"),
                    mapCaption: td("diffMapCaption"),
                    nothing: td("diffNothing"),
                },
                diff: page.slot,
                placeholder: PLACEHOLDER,
                grid: GRID,
                slotLabels: slotLabels(t("notFound")),
            }}
            on={{ retry: page.retry }}
        />
    )
}

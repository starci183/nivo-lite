"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { AgentWorkflowVersionBase } from "@/components/blocks/AgentWorkflowVersion/component"
import { useWorkflowTemplatePreview } from "@/hooks/agentWorkflowPages"
import { useAgentRoute } from "@/hooks/installations"
import { useSlotLabels } from "@/hooks/slot"
import { EMPTY_STEPS_MAP } from "@/hooks/workflowSteps"
import type { PaneGridLayout, WorkflowDiffReadView } from "@/modules/types"

/** The workflow and the template version whose preview this is; none on the loading route, which reads the address. */
type AgentWorkflowTemplatePreviewProps = {
    readonly installationId?: string | undefined
    readonly workflowKey?: string | undefined
    readonly templateVersion?: number | undefined
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

/**
 * The connected page of what a newer template version would change in a workflow: the same cards as the page of a version (steps,
 * rights and tools, map), read from `agentWorkflowTemplatePreview`. Read-only; the update itself is the command of the workflow's page.
 */
export const AgentWorkflowTemplatePreview = (props: AgentWorkflowTemplatePreviewProps) => {
    const t = useTranslations("agentWorkflowPages")
    const td = useTranslations("agentWorkflows")
    const slotLabels = useSlotLabels()
    const route = useAgentRoute(props)
    const named = Number(useParams<{ templateVersion?: string }>().templateVersion ?? "0")
    const page = useWorkflowTemplatePreview(route.installationId, route.workflowKey, props.templateVersion ?? named)
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

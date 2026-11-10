"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentWorkflowDiffSwr } from "@/hooks/swr"
import { diffViewOf } from "@/modules/agentWorkflows"
import { EMPTY_STEPS_MAP } from "@/modules/workflowSteps"
import type { DataSlot, WorkflowDiffReadView, WorkflowDrawerView } from "@/modules/types"
import type { AgentWorkflowsRead } from "./useAgentWorkflows"
import { useWorkflowContext } from "./useWorkflowContext"

/** What the drawer holds while it is shut: nothing to read, so the drawer stays drawn (shut) beside the page. */
const SHUT: WorkflowDiffReadView = { title: "", view: { steps: [], lines: [], kept: "", flow: EMPTY_STEPS_MAP } }

/** The diff drawer: what it is open for and the diff it draws. */
export interface WorkflowDiffData {
    readonly drawer: WorkflowDrawerView
    readonly open: (drawer: NonNullable<WorkflowDrawerView>) => void
    readonly close: () => void
    readonly slot: DataSlot<WorkflowDiffReadView>
}

/** The diff of a version against the one before it, or of the newer template against the open workflow, for the drawer. */
export const useWorkflowDiff = (installationId: string, workflows: AgentWorkflowsRead): WorkflowDiffData => {
    const t = useTranslations("agentWorkflows")
    const context = useWorkflowContext()
    const [drawer, setDrawer] = useState<WorkflowDrawerView>(null)
    const { selected, preview } = workflows
    const version = useQueryAgentWorkflowDiffSwr(
        selected === undefined || drawer?.kind !== "version"
            ? null
            : { installationId, workflowId: selected.id, number: drawer.number, against: "previous" },
    )
    const view = useMemo((): WorkflowDiffReadView | undefined => {
        if (drawer?.kind === "template" && preview !== undefined)
            return {
                title: t("diffTemplateTitle", { version: preview.templateVersion }),
                view: diffViewOf(preview.diff, preview.conflicts, context),
            }
        if (drawer?.kind === "version" && version.data !== undefined)
            return {
                title: t(version.data.beforeJson === null ? "diffFirstTitle" : "diffVersionTitle", { number: drawer.number }),
                view: diffViewOf(version.data, [], context),
            }
        return undefined
    }, [drawer, preview, version.data, context, t])
    return {
        drawer,
        open: setDrawer,
        close: () => setDrawer(null),
        slot: slotOfSwr<WorkflowDiffReadView>({
            data: drawer === null ? SHUT : view,
            error: drawer?.kind === "version" ? version.error : undefined,
            isLoading: drawer !== null && view === undefined,
        }),
    }
}

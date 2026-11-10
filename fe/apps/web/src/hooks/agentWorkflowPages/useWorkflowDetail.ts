"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef } from "react"
import { useAgentRuns, type AgentRunsData } from "@/hooks/agentRuns"
import { useAgentWorkflows, useWorkflowDiff, useWorkflowWrites } from "@/hooks/agentWorkflows"
import { useQueryAgentWorkflowsSwr } from "@/hooks/swr"
import { useWorkflowSteps, type WorkflowSteps } from "@/hooks/workflowSteps"
import { overviewOf } from "@/modules/agentWorkflowPages"
import { graphOfSpec, specOf, stepsLocaleOf } from "@/modules/workflowSteps"
import type { DataSlot, WorkflowDetailView, WorkflowDiffReadView, WorkflowOverviewView } from "@/modules/types"

/** Everything the page of one workflow draws: the workflow, its overview, its map and drawer, its runs. */
export interface WorkflowDetail {
    readonly detail: DataSlot<WorkflowDetailView>
    readonly overview: WorkflowOverviewView
    readonly steps: WorkflowSteps
    readonly runs: AgentRunsData
    readonly rollback: (number: number) => void
    /** The diff of a version against the one before it, in a drawer. */
    readonly diff: {
        readonly slot: DataSlot<WorkflowDiffReadView>
        readonly isOpen: boolean
        readonly open: (number: number) => void
        readonly close: () => void
    }
    readonly retry: () => void
}

/** The workflow of a key (or of an id, as the old addresses carried it): its id, or an empty string while the list is unread. */
const useWorkflowId = (installationId: string, key: string): string => {
    const locale = useLocale()
    const list = useQueryAgentWorkflowsSwr({ installationId, locale })
    return list.data?.find((one) => one.key === key || one.id === key)?.id ?? ""
}

/** The page of one workflow of an agent: its read, its overview, the map with its drawer, and the runs narrowed to it. */
export const useWorkflowDetail = (module: string, installationId: string, key: string): WorkflowDetail => {
    const t = useTranslations("agentWorkflowPages")
    const locale = stepsLocaleOf(useLocale())
    const workflowId = useWorkflowId(installationId, key)
    const workflows = useAgentWorkflows(installationId)
    const { select } = workflows
    useEffect(() => {
        if (workflowId !== "") select(workflowId)
    }, [select, workflowId])
    const writes = useWorkflowWrites(installationId, workflows)
    const diff = useWorkflowDiff(installationId, workflows)
    const runs = useAgentRuns(module, installationId)
    // The setter of the filter is made again on every render; the effect must run only when the workflow changes.
    const setRunsFilter = useRef(runs.setFilter)
    useEffect(() => {
        setRunsFilter.current = runs.setFilter
    })
    useEffect(() => {
        if (workflowId !== "") setRunsFilter.current({ workflow: workflowId })
    }, [workflowId])
    const { selected } = workflows
    const steps = useWorkflowSteps({
        installationId,
        graph: workflows.graphJson,
        workflow: selected === undefined ? null : { id: selected.id, latestNumber: selected.latestNumber },
        onSaved: workflows.refresh,
    })
    const spec = useMemo(() => specOf(workflows.graphJson), [workflows.graphJson])
    const overview = useMemo(
        () => overviewOf(spec, graphOfSpec(spec, locale), (word, values) => t(word, values)),
        [spec, locale, t],
    )
    return {
        detail: workflows.detail,
        overview,
        steps,
        runs,
        rollback: writes.rollback,
        diff: {
            slot: diff.slot,
            isOpen: diff.drawer !== null,
            open: (number) => diff.open({ kind: "version", number }),
            close: diff.close,
        },
        retry: () => void workflows.refresh(),
    }
}

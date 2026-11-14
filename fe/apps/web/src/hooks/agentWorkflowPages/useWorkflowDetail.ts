"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef } from "react"
import { useAgentRuns, type AgentRunsData } from "@/hooks/agentRuns"
import { useAgentWorkflows, useWorkflowWrites } from "@/hooks/agentWorkflows"
import { useWorkflowSteps, type WorkflowSteps } from "@/hooks/workflowSteps"
import { paramLabelOf } from "@/modules/plugin-registry"
import { useWorkflowId } from "./useWorkflowId"
import { overviewOf } from "@/modules/agentWorkflowPages"
import { graphOfSpec, specOf, stepsLocaleOf } from "@/modules/workflowSteps"
import type { DataSlot, WorkflowDetailView, WorkflowOverviewView, WorkflowStatus } from "@/modules/types"

/** Everything the page of one workflow draws: the workflow, its overview, its map and drawer, its runs. */
export interface WorkflowDetail {
    readonly detail: DataSlot<WorkflowDetailView>
    readonly overview: WorkflowOverviewView
    readonly steps: WorkflowSteps
    readonly runs: AgentRunsData
    readonly rollback: (number: number) => void
    /** Turns the workflow on or pauses it. */
    readonly setStatus: (status: WorkflowStatus) => void
    /** Updates the workflow to the newer template version (a new version). */
    readonly sync: () => void
    /** True while one of the writes of this page is on its way. */
    readonly isWriting: boolean
    readonly retry: () => void
}

/** The page of one workflow of an agent: its read, its overview, the map with its step drawer, and the runs narrowed to it. */
export const useWorkflowDetail = (
    module: string,
    installationId: string,
    key: string,
): WorkflowDetail => {
    const t = useTranslations("agentWorkflowPages")
    const locale = stepsLocaleOf(useLocale())
    const workflowId = useWorkflowId(installationId, key)
    const workflows = useAgentWorkflows(installationId)
    const { select } = workflows
    useEffect(() => {
        if (workflowId !== "") select(workflowId)
    }, [select, workflowId])
    const writes = useWorkflowWrites(installationId, workflows)
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
        () =>
            overviewOf(
                spec,
                graphOfSpec(spec, locale),
                (word, values) => t(word, values),
                (name) => paramLabelOf(name, locale),
            ),
        [spec, locale, t],
    )
    return {
        detail: workflows.detail,
        overview,
        steps,
        runs,
        rollback: writes.rollback,
        setStatus: writes.setStatus,
        sync: writes.sync,
        isWriting: writes.isWriting,
        retry: () => void workflows.refresh(),
    }
}

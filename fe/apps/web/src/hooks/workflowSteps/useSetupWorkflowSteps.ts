"use client"

import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { useAgentGraphRead } from "@/hooks/agentGraph"
import { useQueryAgentWorkflowSwr, useQueryAgentWorkflowsSwr } from "@/hooks/swr"
import { useWorkflowSteps } from "./useWorkflowSteps"
import type { WorkflowSteps } from "./useWorkflowSteps"

/**
 * The card map of the Setup page and the drawer of its steps: the graph of the workflow `?workflow=` names (any of the agent's, as
 * "Sửa sơ đồ" of the Workflows tab opens it), else of the agent's main workflow (the version it runs), else the flow of the agent graph
 * while the agent has no workflow. A save writes the next version of that workflow (`expectedLatest` the version read), never the
 * template, then reads the workflow and the agent graph again, so the map shows the new values.
 */
export const useSetupWorkflowSteps = (installationId: string, reloadGraph: () => void): WorkflowSteps => {
    const locale = useLocale()
    const list = useQueryAgentWorkflowsSwr({ installationId, locale })
    const named = useSearchParams().get("workflow")
    const target =
        list.data?.find((workflow) => workflow.id === named) ?? list.data?.find((workflow) => workflow.primary)
    const read = useQueryAgentWorkflowSwr(
        target === undefined ? null : { installationId, workflowId: target.id, locale },
    )
    const agentGraph = useAgentGraphRead(installationId, 0)
    const flow = agentGraph.read === undefined ? null : Reflect.get(agentGraph.read.wire.document, "flow")
    const { mutate: reloadList } = list
    const { mutate: reloadRead } = read
    const onSaved = useCallback(async () => {
        await Promise.all([reloadList(), reloadRead()])
        reloadGraph()
    }, [reloadList, reloadRead, reloadGraph])
    return useWorkflowSteps({
        installationId,
        graph: read.data?.graphJson ?? (target === undefined ? flow : null),
        workflow: target === undefined ? null : { id: target.id, latestNumber: target.latestNumber },
        onSaved,
    })
}

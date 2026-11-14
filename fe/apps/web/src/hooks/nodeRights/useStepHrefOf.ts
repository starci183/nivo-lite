"use client"

import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workflowStepPath, workspaceHref } from "@/modules/routes"
import type { StepHrefOf } from "./nodeRights.shared"

/**
 * The address of one step (`…/agents/<module>/<installation>/workflows/<key>/map?step=<node>`) from the agent that runs it: the
 * agent's page is found among the workspace's installations; null while they are read or when the agent has no page.
 */
export const useStepHrefOf = (): StepHrefOf => {
    const workspaceId = useWorkspaceId()
    const installations = useQueryModuleInstallationsSwr().data
    return (agentId, workflowKey, nodeKey) => {
        const found = installations?.find((one) => one.agentId === agentId)
        return found === undefined
            ? null
            : workspaceHref(workspaceId, workflowStepPath(found.moduleKey, found.id, workflowKey, nodeKey))
    }
}

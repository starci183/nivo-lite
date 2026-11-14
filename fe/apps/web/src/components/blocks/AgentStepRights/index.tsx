"use client"

import { useState } from "react"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useAgentRoute } from "@/hooks/installations"
import { useAgentNodeRights, useNodeRightsCopy } from "@/hooks/nodeRights"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentStepRightsBase } from "./component"
import { STEP_RIGHTS_PLACEHOLDER, stepRightsOf } from "./view"

/** The agent of the url. */
interface AgentStepRightsProps {
    readonly workspaceId?: string | undefined
    readonly module?: string | undefined
    readonly installationId?: string | undefined
}

/**
 * The roll-up what the agent's steps call of the agent › rights page (read-only): every right the agent's workflow steps hold, the operation, its mode and the step that uses it (a link to that step). The rows come from `agentNodeRights`; what is
 * folded behind "N more" is the API's row count less the rows shown.
 */
export const AgentStepRights = (props: AgentStepRightsProps) => {
    const route = useAgentRoute(props)
    const copy = useNodeRightsCopy()
    const slotLabels = useSlotLabels()
    const agent = useAgentInstallation(route.installationId, route.module).slot
    const agentId = "items" in agent ? (agent.items.agentId ?? null) : null
    const rights = useAgentNodeRights(agentId)
    const [isOpen, setIsOpen] = useState(false)
    const words = { moreOperations: copy.agent.moreOperations, more: copy.common.more }
    const slot = mapSlot(rights.slot, (answer) => stepRightsOf(answer, isOpen, words))
    return (
        <AgentStepRightsBase
            props={{
                title: copy.agent.stepsTitle,
                hint: copy.agent.stepsHint,
                empty: copy.agent.stepsEmpty,
                columnOperation: copy.agent.columnOperation,
                columnMode: copy.agent.columnMode,
                columnStep: copy.agent.columnStep,
                read: { slot, placeholder: STEP_RIGHTS_PLACEHOLDER, labels: slotLabels(copy.agent.stepsTitle) },
            }}
            on={{
                more: () => setIsOpen(true),
                retry: rights.retry,
            }}
        />
    )
}

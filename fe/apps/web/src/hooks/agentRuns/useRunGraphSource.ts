"use client"

import { useAgentGraphRead } from "@/hooks/agentGraph"
import { useQueryAgentWorkflowDiffSwr } from "@/hooks/swr"

/** The workflow and version a run is pinned to. */
interface RunPin {
    readonly workflowId: string
    readonly version: number
}

/**
 * The graph a run ran on: the snapshot of the workflow version it is pinned to (the `afterJson` of that version's diff, the full
 * graph as published), so the map and the read-only settings are the ones the run used. Only a run with no pin (or a snapshot that
 * cannot be read) falls back to the flow of the agent's current graph. Null while the pin or the snapshot is still being read.
 */
export const useRunGraphSource = (installationId: string, pin: RunPin | undefined, isPinRead: boolean): unknown => {
    const snapshot = useQueryAgentWorkflowDiffSwr(
        pin === undefined
            ? null
            : { installationId, workflowId: pin.workflowId, number: pin.version, against: "previous" },
    )
    const current = useAgentGraphRead(installationId, 0)
    const flow = current.read === undefined ? null : Reflect.get(current.read.wire.document, "flow")
    if (!isPinRead) return null
    if (pin === undefined || snapshot.error !== undefined) return flow
    return snapshot.data?.afterJson ?? null
}

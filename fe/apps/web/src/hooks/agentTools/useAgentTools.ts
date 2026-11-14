"use client"

import { useQueryAgentToolsSwr } from "@/hooks/swr"
import type { AgentToolWire } from "@/modules/agentTools"

/** The tools one agent may call (read only). */
interface AgentTools {
    /** The tools, or undefined while the read is under way or when it failed (no such query yet, or not owner or manager). */
    readonly tools: ReadonlyArray<AgentToolWire> | undefined
}

/** `agentTools` for one agent. */
export const useAgentTools = (agentId: string | null): AgentTools => {
    const read = useQueryAgentToolsSwr(agentId)
    return { tools: read.error === undefined ? read.data : undefined }
}

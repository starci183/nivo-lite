"use client"

import { useCallback } from "react"
import { useMcpGrantCommands } from "@/hooks/mcpGrants"
import { useQueryAgentToolsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import { withGrant, type AgentToolGrantMode, type AgentToolWire } from "@/modules/agentTools"

/** The tools one agent may call, and the owner's grant on one of them. */
interface AgentTools {
    /** The tools, or undefined while the read is under way or when it failed (no such query yet, or not owner or manager). */
    readonly tools: ReadonlyArray<AgentToolWire> | undefined
    /** Sets the grant of one of the agent's tools (`auto`, `ask` or `never`); shown at once, then read again. */
    readonly setGrant: (tool: string, mode: AgentToolGrantMode) => void
    readonly isSaving: boolean
}

/**
 * `agentTools` for one agent, and its grant through `setMcpToolGrant` (`useMcpGrantCommands`, which keeps a grant's constraints and money
 * limit; the grants are read only once the tools answered, so a person who may not read them reads neither).
 */
export const useAgentTools = (agentId: string | null): AgentTools => {
    const read = useQueryAgentToolsSwr(agentId)
    const grants = useQueryMcpToolGrantsSwr(read.data !== undefined)
    const { mutate: reloadTools, data } = read
    const { mutate: reloadGrants } = grants
    const reload = useCallback(() => Promise.all([reloadGrants(), reloadTools()]), [reloadGrants, reloadTools])
    const commands = useMcpGrantCommands(grants.data ?? [], reload)
    const { setMode } = commands
    const setGrant = useCallback(
        (tool: string, mode: AgentToolGrantMode) => {
            if (agentId === null || data === undefined) return
            void reloadTools(withGrant(data, tool, mode), { revalidate: false })
            void setMode(agentId, tool, mode)
        },
        [agentId, data, reloadTools, setMode],
    )
    return {
        tools: read.error === undefined ? data : undefined,
        setGrant,
        // A save keeps the constraints of the grant row, so the controls wait for the grants read.
        isSaving: commands.busyKey !== null || grants.isLoading || grants.error !== undefined,
    }
}

"use client"

import { useInstallations } from "@/hooks/installations"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, workspaceHref } from "@/modules/routes"

/** The agent whose setup page the chat links to. */
interface AgentChatSetupAgent {
    readonly id: string
    readonly module: string
}

/**
 * The setup page of the agent the chat talks to: the instance it drives, else its type, else the catalogue; none while the
 * installations are being read.
 */
export const useAgentChatSetupHref = (agent: AgentChatSetupAgent | undefined): string | null => {
    const { installations } = useInstallations()
    const workspaceId = useWorkspaceId()
    if (agent === undefined) return null
    if (installations === undefined) return null
    const own = installations.find((entry) => entry.agentId === agent.id)
    if (own !== undefined) return workspaceHref(workspaceId, agentHref(own.moduleKey, own.id))
    return workspaceHref(workspaceId, isModuleKey(agent.module) ? agentHref(agent.module, null) : AGENTS_ROUTE)
}

"use client"

import { useInstallations } from "@/hooks/installations"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { AGENTS_ROUTE, agentSetupHref } from "@/modules/routes"

/** The agent whose setup page the chat links to. */
interface AgentChatSetupAgent {
    readonly id: string
    readonly module: string
}

/**
 * The setup page of the agent the chat talks to: the instance it drives, else its type, else the catalogue. While the
 * installations are being read the old agent address stands in, which sends the person to the same page.
 */
export const useAgentChatSetupHref = (agent: AgentChatSetupAgent | undefined): string | null => {
    const { installations } = useInstallations()
    if (agent === undefined) return null
    if (installations === undefined) return agentSetupHref(agent.id)
    const own = installations.find((entry) => entry.agentId === agent.id)
    if (own !== undefined) return agentHref(own.moduleKey, own.id)
    return isModuleKey(agent.module) ? agentHref(agent.module, null) : AGENTS_ROUTE
}

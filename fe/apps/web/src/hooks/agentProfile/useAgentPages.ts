"use client"

import { useInstallations } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/** The pages of the installed agent a profile is about; null while the agent has no instance or the list has not arrived. */
export interface AgentPages {
    /** The agent's own page (its workbench). */
    readonly home: string
    /** Everything the agent did (its Work tab). */
    readonly work: string
}

/** Where "Mo agent" and "Xem tat ca" of an agent profile lead: the instance that is driven by this agent, in this workspace. */
export const useAgentPages = (agentId: string): AgentPages | null => {
    const workspaceId = useWorkspaceId()
    const { installations } = useInstallations()
    const installation = installations?.find((entry) => entry.agentId === agentId)
    if (installation === undefined || !isModuleKey(installation.moduleKey)) return null
    return {
        home: workspaceHref(workspaceId, agentHref(installation.moduleKey, installation.id)),
        work: workspaceHref(workspaceId, agentHref(installation.moduleKey, installation.id, "work")),
    }
}

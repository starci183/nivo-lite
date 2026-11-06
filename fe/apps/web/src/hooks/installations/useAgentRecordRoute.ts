"use client"

import { useEffect } from "react"
import { useQueryAgentsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { isModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import { AGENTS_ROUTE, workspaceHref } from "@/modules/routes"
import { useInstallations } from "./useInstallations"

/**
 * Sends an old agent url (/modules/<agentId>) to the instance that agent drives, else to its type, else to the catalogue. Answers
 * whether the agent is unknown to the workspace once both lists are read.
 */
export const useAgentRecordRoute = (agentId: string): { readonly isUnknown: boolean } => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const agents = useQueryAgentsSwr({})
    const { installations } = useInstallations()
    const agent = agents.data?.find((entry) => entry.id === agentId)
    const target = (() => {
        if (agent === undefined || installations === undefined) return null
        const own = installations.find((entry) => entry.agentId === agent.id)
        if (own !== undefined) return workspaceHref(workspaceId, agentHref(own.moduleKey, own.id))
        return workspaceHref(workspaceId, isModuleKey(agent.module) ? agentHref(agent.module, null) : AGENTS_ROUTE)
    })()
    useEffect(() => {
        if (target !== null) router.replace(target)
    }, [target, router])
    return { isUnknown: agents.data !== undefined && agent === undefined }
}

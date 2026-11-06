"use client"

import { useCallback } from "react"
import { useInstallations } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/**
 * Where the report of one agent run opens: the work tab of the agent that wrote it, on that run. Null while the installed agents are
 * read, or when no installed agent has that id (an agent that was removed).
 */
export const useTeamChatReportHref = (): ((agentId: string, runId: string) => string | null) => {
    const workspaceId = useWorkspaceId()
    const { installations } = useInstallations()
    return useCallback(
        (agentId: string, runId: string): string | null => {
            const installation = installations?.find((entry) => entry.agentId === agentId)
            if (installation === undefined) return null
            return workspaceHref(
                workspaceId,
                agentHref(installation.moduleKey, installation.id, "work", `run=${encodeURIComponent(runId)}`),
            )
        },
        [installations, workspaceId],
    )
}

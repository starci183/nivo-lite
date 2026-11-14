"use client"

import { useEffect } from "react"
import { isManager, useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref, isSetupPending, type AgentTab } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { useInstallations } from "./useInstallations"

/** The tab a landing opens: Setup for an owner or manager of an agent that is not set up, the workbench for everyone else. */
const landingTabOf = (isPending: boolean, canSetUp: boolean): AgentTab => (isPending && canSetUp ? "setup" : "workbench")

/**
 * Sends the bare url of an agent instance to the tab it opens on: a new or unpublished agent opens on Setup, a running one on the
 * workbench. An unknown instance is left to the frame's guard. It waits for the installed agents and the member before leaving.
 */
export const useAgentLanding = (module: ModuleKey, installationId: string): void => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useMember()
    const { installations } = useInstallations()
    const installation = installations?.find((entry) => entry.id === installationId)
    const lifecycle = installation?.lifecycle ?? null
    const tab = member === null || installation === undefined ? null : landingTabOf(isSetupPending(lifecycle), isManager(member))
    useEffect(() => {
        if (tab !== null) router.replace(workspaceHref(workspaceId, agentHref(module, installationId, tab)))
    }, [tab, router, workspaceId, module, installationId])
}

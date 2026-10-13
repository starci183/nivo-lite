"use client"

import { useEffect } from "react"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useSyncActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { workspacePaymentPath, workspacesPath } from "@/modules/routes"
import { UNPAID_WORKSPACE_STATES } from "./console.shared"
import { useConsoleSession } from "./useConsoleSession"

/**
 * Whether the console frame may render: the session is read. Without an active membership the person is sent to the workspaces
 * page, an unpaid workspace sends them to its payment step, and the GraphQL client is kept on the session's workspace.
 */
export const useConsoleGate = (): boolean => {
    const memberships = useQueryMyWorkspacesSwr()
    const session = useConsoleSession()
    const router = navigation.useRouter()
    useSyncActiveWorkspace(session?.currentWorkspaceId)
    const current = memberships.data?.find((entry) => entry.workspace.id === session?.currentWorkspaceId)
    let exit: string | undefined
    if (memberships.data !== undefined && !memberships.data.some((entry) => entry.member.status === "active"))
        exit = workspacesPath(memberships.data.length > 0 ? "disabled" : "none")
    else if (current !== undefined && UNPAID_WORKSPACE_STATES.has(current.workspace.status))
        exit = workspacePaymentPath(current.workspace.id)
    useEffect(() => {
        if (exit !== undefined) router.replace(exit)
    }, [exit, router])
    return session !== undefined && exit === undefined
}

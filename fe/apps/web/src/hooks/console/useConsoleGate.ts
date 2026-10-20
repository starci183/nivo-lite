"use client"

import { useEffect } from "react"
import { useMutateStartFirstWorkspaceSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useSyncActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { workspacePaymentPath, workspacesPath } from "@/modules/routes"
import { UNPAID_WORKSPACE_STATES } from "./console.shared"
import { useConsoleSession } from "./useConsoleSession"

/**
 * Whether the console frame may render: the session is read. A person with no membership at all first gets their first workspace
 * from the back end (created only where free signup is allowed: local and demo); when none is created they are sent to the
 * workspaces page, as is a disabled member. An unpaid workspace sends them to its payment step, and the GraphQL client is kept on the
 * session's workspace.
 */
export const useConsoleGate = (): boolean => {
    const memberships = useQueryMyWorkspacesSwr()
    const session = useConsoleSession()
    const router = navigation.useRouter()
    useSyncActiveWorkspace(session?.currentWorkspaceId)
    const isEmpty = memberships.data?.length === 0
    const first = useMutateStartFirstWorkspaceSwr(isEmpty)
    const noFirstWorkspace = first.data === null || first.error !== undefined
    const current = memberships.data?.find((entry) => entry.workspace.id === session?.currentWorkspaceId)
    let exit: string | undefined
    if (isEmpty) exit = noFirstWorkspace ? workspacesPath("none") : undefined
    else if (memberships.data !== undefined && !memberships.data.some((entry) => entry.member.status === "active"))
        exit = workspacesPath("disabled")
    else if (current !== undefined && UNPAID_WORKSPACE_STATES.has(current.workspace.status))
        exit = workspacePaymentPath(current.workspace.id)
    useEffect(() => {
        if (exit !== undefined) router.replace(exit)
    }, [exit, router])
    return session !== undefined && exit === undefined
}

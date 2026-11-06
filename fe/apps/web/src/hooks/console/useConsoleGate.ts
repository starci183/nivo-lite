"use client"

import { useEffect } from "react"
import { useMutateStartFirstWorkspaceSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { workspaceHref, workspacePaymentPath, workspacesPath } from "@/modules/routes"
import { rememberWorkspaceCookie } from "@/modules/storage"
import type { ConsoleSessionView } from "@/modules/types"
import { OFFICE_ROUTE, UNPAID_WORKSPACE_STATES } from "./console.shared"
import { useConsoleSessionRead } from "./useConsoleSessionRead"

/** What the console gate reads to decide whether the workspace of the address may be worked in. */
interface ConsoleExitInput {
    /** Every membership of the person; none while unread. */
    readonly memberships:
        | ReadonlyArray<{
              readonly workspace: { readonly id: string; readonly status: string }
              readonly member: { readonly status: string }
          }>
        | undefined
    readonly workspaceId: string
    /** The first workspace the back end made for a person who had none: its id, `null` when none was made, `undefined` while it is asked. */
    readonly first: string | null | undefined
}

/**
 * Where the person leaves the console for, or `undefined` while it may stay: a person with no membership goes to their new first
 * workspace, or to the workspaces page when none was made; a disabled member goes there too; an unpaid workspace goes to its payment step.
 */
const consoleExitOf = (input: ConsoleExitInput): string | undefined => {
    const { memberships, workspaceId, first } = input
    if (memberships === undefined) return undefined
    if (memberships.length === 0) {
        if (first === undefined) return undefined
        return first === null ? workspacesPath("none") : workspaceHref(first, OFFICE_ROUTE)
    }
    const current = memberships.find((entry) => entry.workspace.id === workspaceId)
    if (current === undefined) return undefined
    if (current.member.status !== "active") return workspacesPath("disabled")
    return UNPAID_WORKSPACE_STATES.has(current.workspace.status) ? workspacePaymentPath(workspaceId) : undefined
}

/** The SWR session and whether the console may mount its readers. */
interface ConsoleGate {
    readonly session: ConsoleSessionView | undefined
    readonly isReady: boolean
}

/**
 * Whether the console frame may render for the workspace of the address: the session in it is read. A person with no membership at
 * all first gets their first workspace from the back end (created only where free signup is allowed: local and demo); when none is
 * created they are sent to the workspaces page, as is a disabled member. An unpaid workspace sends them to its payment step. A
 * workspace that opens is remembered, so the front address and the picker lead back to it.
 */
export const useConsoleGate = (): ConsoleGate => {
    const workspaceId = useWorkspaceId()
    const memberships = useQueryMyWorkspacesSwr()
    const session = useConsoleSessionRead()
    const router = navigation.useRouter()
    const isEmpty = memberships.data?.length === 0
    const first = useMutateStartFirstWorkspaceSwr(isEmpty)
    const exit = consoleExitOf({
        memberships: memberships.data,
        workspaceId,
        first: first.error === undefined ? first.data : null,
    })
    useEffect(() => {
        if (exit !== undefined) router.replace(exit)
    }, [exit, router])
    const isReady = session !== undefined && exit === undefined
    useEffect(() => {
        if (isReady) rememberWorkspaceCookie(workspaceId)
    }, [isReady, workspaceId])
    return { session, isReady }
}

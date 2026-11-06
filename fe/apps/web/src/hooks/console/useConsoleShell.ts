"use client"

import { useMemo } from "react"
import { useQueryWorkspaceShellSwr } from "@/hooks/swr"
import { FOUNDING_OFFER } from "@/modules/promo"

const SHELL_WINDOW = { foundingFrom: FOUNDING_OFFER.startsAt, foundingTo: FOUNDING_OFFER.endsAt } as const

/** What the console frame draws from the back end: whether the workspace is a founding member. */
export interface ConsoleShellView {
    readonly isFoundingMember: boolean
}

const EMPTY: ConsoleShellView = { isFoundingMember: false }

/** Reads the console frame facts of a workspace (the back end `workspaceShell` query) and shapes them for the top bar. */
export const useConsoleShell = (workspaceId: string): ConsoleShellView => {
    const { data } = useQueryWorkspaceShellSwr(workspaceId, SHELL_WINDOW)
    return useMemo(
        (): ConsoleShellView => (data === undefined ? EMPTY : { isFoundingMember: data.isFoundingMember }),
        [data],
    )
}

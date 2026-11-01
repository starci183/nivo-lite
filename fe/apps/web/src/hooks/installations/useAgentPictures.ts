"use client"

import { useMemo } from "react"
import { useInstallations } from "./useInstallations"

/** Who a screen names: the @handle when it has one, else the display name. */
export interface AgentRef {
    readonly handle?: string | null | undefined
    readonly name?: string | null | undefined
}

/**
 * The pictures of the installed agents of the active workspace, from the installations the app already holds. Screens that name an
 * agent without carrying its picture (owners, thread authors, approvals, the profile lists) draw it through this lookup, so a new
 * picture shows everywhere once the installations are read again. Answers null (the NIVO unicorn mascot) for an unknown agent.
 */
export const useAgentPictures = (): ((agent: AgentRef) => string | null) => {
    const { installations } = useInstallations()
    return useMemo(() => {
        const rows = installations ?? []
        const byHandle = new Map(rows.map((row) => [row.agentHandle, row.agentAvatarUrl]))
        const byName = new Map(rows.map((row) => [row.name, row.agentAvatarUrl]))
        return (agent) => byHandle.get(agent.handle ?? "") ?? byName.get(agent.name ?? "") ?? null
    }, [installations])
}

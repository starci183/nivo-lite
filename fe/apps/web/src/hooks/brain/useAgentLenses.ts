"use client"

import { useMemo } from "react"
import { useQueryAgentKnowledgeLensesSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { toAgentLens, type AgentLens } from "@/modules/brain"
import { readError } from "@/hooks/workspaceread"
import type { DataSlot } from "@/modules/types"

/** The view `useAgentLenses` returns. */
export interface AgentLensesView {
    lenses: readonly AgentLens[] | undefined
    error: unknown
    isLoading: boolean
    slot: DataSlot<readonly AgentLens[]>
    reload: () => undefined
}

/** What each view of the shared knowledge reads: the customer's, then every installed agent's. */
export const useAgentLenses = (): AgentLensesView => {
    const swrRead = useQueryAgentKnowledgeLensesSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const lenses = useMemo<ReadonlyArray<AgentLens> | undefined>(() => data?.map((entry) => toAgentLens(entry)), [data])
    const slot = slotOfSwr({ data: lenses, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { lenses, error, isLoading, slot, reload }
}

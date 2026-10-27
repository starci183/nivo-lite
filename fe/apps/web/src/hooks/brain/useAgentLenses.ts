"use client"

import { useMemo } from "react"
import { useQueryAgentKnowledgeLensesSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { toAgentLens } from "@/modules/brain"
import type { AgentLens } from "@/modules/brain"
import { readError } from "@/hooks/workspaceread"

/** What each view of the shared knowledge reads: the customer's, then every installed agent's. */
export const useAgentLenses = () => {
    const swrRead = useQueryAgentKnowledgeLensesSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const lenses = useMemo<ReadonlyArray<AgentLens> | undefined>(() => data?.map(toAgentLens), [data])
    const slot = slotOfSwr({ data: lenses, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { lenses, error, isLoading, slot, reload }
}

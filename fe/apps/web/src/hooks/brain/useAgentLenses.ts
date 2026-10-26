"use client"

import { useMemo } from "react"
import { useQueryAgentKnowledgeLensesSwr } from "@/hooks/swr"
import { toAgentLens } from "@/modules/brain"
import type { AgentLens } from "@/modules/brain"
import { readError } from "@/hooks/workspaceread"

/** What each view of the shared knowledge reads: the customer's, then every installed agent's. */
export const useAgentLenses = () => {
    const swrRead = useQueryAgentKnowledgeLensesSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const lenses = useMemo<ReadonlyArray<AgentLens> | undefined>(() => data?.map(toAgentLens), [data])
    return { lenses, error, isLoading }
}

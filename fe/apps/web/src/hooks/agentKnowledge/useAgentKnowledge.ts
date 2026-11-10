"use client"

import { useInstanceAgentId } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentKnowledgeSwr } from "@/hooks/swr"
import type { AgentKnowledgeQuery } from "@/modules/api"
import type { DataSlot } from "@/modules/types"

/** What one agent reads of the shared knowledge, as the back end answers it. */
export type AgentKnowledgeData = AgentKnowledgeQuery["agentKnowledge"]

/** The view `useAgentKnowledge` returns. */
interface AgentKnowledgeRead {
    readonly slot: DataSlot<AgentKnowledgeData>
    readonly reload: () => undefined
}

/**
 * What the agent of one instance reads of the shared knowledge: the layers, the documents, the facts that wait and the facts only it
 * reads. The agent that drives the instance is read first, so the slot is loading until both are known.
 */
export const useAgentKnowledge = (module: ModuleKey, installationId: string): AgentKnowledgeRead => {
    const agentId = useInstanceAgentId(module, installationId)
    const read = useQueryAgentKnowledgeSwr(agentId === null ? null : { agentId })
    const slot = slotOfSwr({ data: read.data, error: read.error, isLoading: agentId === null || read.isLoading })
    return { slot, reload: () => void read.mutate() }
}

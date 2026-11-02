"use client"

import { useAgentDashboard } from "@/hooks/agentDashboard"
import { slotOfSwr } from "@/hooks/slot"
import type { ModuleKey } from "@/modules/catalog"
import type { DataSlot } from "@/modules/types"

/** How much the knowledge an agent reads holds: the documents and the facts its lens can read, the same two numbers the desk shows. */
export interface SetupKnowledgeCounts {
    readonly documents: number
    readonly facts: number
}

/** What a lens counts, as the dashboard reads it. */
interface LensCounts {
    readonly audience: string
    readonly documents: { readonly public: number; readonly internal: number }
    readonly facts: { readonly public: number; readonly internal: number }
}

/** The lens result normalized from its authoritative dashboard read, including a failed knowledge region. */
interface SetupKnowledgeRead {
    readonly data: SetupKnowledgeCounts | undefined
    readonly error: unknown
    readonly isLoading: boolean
    readonly isValidating: boolean
}

/** The documents and facts a lens reads in all: the public ones, plus the internal ones when its audience is internal. */
const readableOf = (knowledge: LensCounts): SetupKnowledgeCounts => {
    const isInternal = knowledge.audience === "internal"
    return {
        documents: knowledge.documents.public + (isInternal ? knowledge.documents.internal : 0),
        facts: knowledge.facts.public + (isInternal ? knowledge.facts.internal : 0),
    }
}

/**
 * What the agent reads, counted from the one place the desk reads it (its lens on the back end): a failed or forbidden read shows as
 * such, one in flight as loading; `reload` reads it again.
 */
export const useSetupKnowledge = (
    moduleKey: ModuleKey,
    installationId: string,
): DataSlot<SetupKnowledgeCounts> & { readonly read: SetupKnowledgeRead; readonly reload: () => void } => {
    const dashboard = useAgentDashboard(moduleKey, installationId)
    const knowledge = "items" in dashboard.slot ? dashboard.slot.items.knowledge : undefined
    const regionFailed = knowledge?.isFailed === true
    const read: SetupKnowledgeRead = {
        data: knowledge === undefined || regionFailed ? undefined : readableOf(knowledge),
        error: dashboard.read.error ?? (regionFailed ? new Error("Knowledge region could not be read") : undefined),
        isLoading: dashboard.read.isLoading,
        isValidating: dashboard.read.isValidating,
    }
    return { ...slotOfSwr(read), read, reload: dashboard.reload }
}

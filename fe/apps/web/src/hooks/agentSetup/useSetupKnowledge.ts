"use client"

import { useMemo } from "react"
import { useAgentDashboard } from "@/hooks/agentDashboard"
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
): DataSlot<SetupKnowledgeCounts> & { readonly reload: () => void } => {
    const { slot, reload } = useAgentDashboard(moduleKey, installationId)
    const counts = useMemo((): SetupKnowledgeCounts | undefined => {
        const knowledge = slot.items?.knowledge
        return knowledge === undefined || knowledge.isFailed ? undefined : readableOf(knowledge)
    }, [slot.items])
    const isFailed = slot.isError === true || slot.items?.knowledge.isFailed === true
    return {
        items: counts,
        isLoading: slot.isLoading,
        isError: isFailed ? true : undefined,
        isForbidden: slot.isForbidden,
        reload,
    }
}

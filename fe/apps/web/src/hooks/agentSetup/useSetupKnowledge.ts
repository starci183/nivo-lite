"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import type { ModuleKey } from "@/modules/catalog"
import type { DataSlot } from "@/modules/types"

/** How many sources the knowledge of a module holds. */
export interface SetupKnowledgeCounts {
    readonly business: number
    readonly publicSources: number
}

/** The ready sources of the workspace that the module reads (its own and the ones for every module), counted; a failed or forbidden read shows as such, one in flight as loading; `reload` reads it again. */
export const useSetupKnowledge = (
    moduleKey: ModuleKey,
): DataSlot<SetupKnowledgeCounts> & { readonly reload: () => void } => {
    const read = useQueryKnowledgeSourcesSwr({ module: moduleKey })
    const { data } = read
    const counts = useMemo((): SetupKnowledgeCounts | undefined => {
        if (data === undefined) return undefined
        const ready = data.filter(
            (source) => source.status === "ready" && (source.module === null || source.module === moduleKey),
        )
        return {
            business: ready.length,
            publicSources: ready.filter((source) => source.visibility === "public").length,
        }
    }, [data, moduleKey])
    return {
        ...slotOfSwr({ data: counts, error: read.error, isLoading: read.isLoading }),
        reload: () => void read.mutate(),
    }
}

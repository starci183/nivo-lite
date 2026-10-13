import { useMemo } from "react"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import type { ModuleKey } from "@/modules/catalog"

/** How many sources the knowledge of a module holds. */
export interface SetupKnowledgeCounts {
    readonly business: number
    readonly publicSources: number
}

/** The ready sources of the workspace that the module reads (its own and the ones for every module), counted; none while they load. */
export const useSetupKnowledge = (moduleKey: ModuleKey): SetupKnowledgeCounts | null => {
    const read = useQueryKnowledgeSourcesSwr({ module: moduleKey })
    const { data } = read
    return useMemo(() => {
        if (data === undefined) return null
        const ready = data.filter(
            (source) => source.status === "ready" && (source.module === null || source.module === moduleKey),
        )
        return {
            business: ready.length,
            publicSources: ready.filter((source) => source.visibility === "public").length,
        }
    }, [data, moduleKey])
}

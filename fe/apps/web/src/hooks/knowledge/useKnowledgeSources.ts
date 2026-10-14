"use client"

import { useMemo } from "react"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import { toKnowledgeDocument } from "@/modules/documents"
import type { ModuleKey } from "@/modules/catalog"

/**
 * The documents of the active workspace, in the shape the blocks know. Polls while a worker is on a document.
 * `module` = "all" or undefined lists every document.
 */
export const useKnowledgeSources = (module?: ModuleKey | "all") => {
    const { data, error, isLoading } = useQueryKnowledgeSourcesSwr(
        module === undefined || module === "all" ? {} : { module },
    )
    const sources = useMemo(() => (data === undefined ? undefined : data.map(toKnowledgeDocument)), [data])
    return { sources, error, isLoading }
}

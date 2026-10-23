"use client"

import { useMemo } from "react"
import { useQueryKnowledgeSuggestionsSwr } from "@/hooks/swr"
import { toSuggestionContext } from "@/modules/documents"
import type { SuggestionContext } from "@/modules/documents"
import { readError } from "@/hooks/workspaceread"

/**
 * The suggestion context of the active workspace (business type + the owner's decisions), in the shape the blocks know.
 * `enabled` gates the read to members allowed to see it (owners and managers).
 */
export const useKnowledgeSuggestions = (enabled: boolean) => {
    const swrRead = useQueryKnowledgeSuggestionsSwr(enabled)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const context = useMemo<SuggestionContext | undefined>(
        () => (data === undefined ? undefined : toSuggestionContext(data)),
        [data],
    )
    return { context, error, isLoading }
}

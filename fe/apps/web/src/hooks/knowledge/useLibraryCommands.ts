"use client"

import { useState } from "react"
import { mutate } from "swr"
import {
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY,
    useMutateRetryKnowledgeSourceSwr,
    useMutateSetKnowledgeSuggestionStateSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { IdeaDecision } from "@/modules/types"

/** What the library commands give the blocks. */
interface LibraryCommands {
    /** The document ids a retry is running for. */
    readonly retrying: ReadonlySet<string>
    readonly isPending: boolean
    readonly retry: (sourceId: string) => void
    /** Decides a suggestion; a null state brings it back. */
    readonly decide: (key: string, state: IdeaDecision | null) => void
}

/** Retrying a failed document and deciding a suggestion; each outcome is toasted and the matching list is revalidated. */
export const useLibraryCommands = (): LibraryCommands => {
    const runGraphQL = useGraphQLWithToast()
    const { trigger: retrySource } = useMutateRetryKnowledgeSourceSwr()
    const { trigger: decideSuggestion, isMutating } = useMutateSetKnowledgeSuggestionStateSwr()
    const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())
    const retry = (sourceId: string) => {
        setRetrying((now) => new Set(now).add(sourceId))
        void runGraphQL(() => retrySource({ id: sourceId }), { showSuccessToast: false }).then(async (done) => {
            setRetrying((now) => new Set([...now].filter((id) => id !== sourceId)))
            if (done !== undefined)
                await mutate((key) => Array.isArray(key) && key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY)
        })
    }
    const decide = (key: string, state: IdeaDecision | null) => {
        void runGraphQL(() => decideSuggestion({ key, state }), { showSuccessToast: false }).then(async (done) => {
            if (done !== undefined)
                await mutate((key) => Array.isArray(key) && key[0] === QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY)
        })
    }
    return { retrying, isPending: isMutating, retry, decide }
}

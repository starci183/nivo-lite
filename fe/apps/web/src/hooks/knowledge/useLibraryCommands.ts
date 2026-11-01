"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSWRConfig } from "swr"
import {
    QUERY_BRAIN_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY,
    useMutateApplyBrainFactGroupSwr,
    useMutateReindexKnowledgeSourceSwr,
    useMutateRetryKnowledgeSourceSwr,
    useMutateSetKnowledgeSuggestionStateSwr,
    useMutateUndoBrainFactBatchSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { IdeaDecision } from "@/modules/types"

/** What the library commands give the blocks. */
interface LibraryCommands {
    /** The document ids a retry is running for. */
    readonly retrying: ReadonlySet<string>
    readonly isPending: boolean
    readonly retry: (sourceId: string) => void
    /** Reads a ready document again so its facts are read. */
    readonly reread: (sourceId: string) => void
    /** Applies the checked facts a document of the owner's proposed, together, as one batch. */
    readonly applyFacts: (sourceId: string) => void
    /** Takes a batch of facts applied together back to review. */
    readonly undoFacts: (batchId: string, sourceId: string) => void
    /** Decides a suggestion; a null state brings it back. */
    readonly decide: (key: string, state: IdeaDecision | null) => void
}

/** Retrying a failed document and deciding a suggestion; each outcome is toasted and the matching list is revalidated. */
export const useLibraryCommands = (): LibraryCommands => {
    const { mutate } = useSWRConfig()
    const runGraphQL = useGraphQLWithToast()
    const { trigger: retrySource } = useMutateRetryKnowledgeSourceSwr()
    const { trigger: reindexSource } = useMutateReindexKnowledgeSourceSwr()
    const { trigger: decideSuggestion, isMutating } = useMutateSetKnowledgeSuggestionStateSwr()
    const { trigger: applyGroup } = useMutateApplyBrainFactGroupSwr()
    const { trigger: undoBatch } = useMutateUndoBrainFactBatchSwr()
    const t = useTranslations("knowledge")
    const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())
    const retry = (sourceId: string) => {
        setRetrying((now) => new Set(now).add(sourceId))
        void runGraphQL(() => retrySource({ id: sourceId }), { showSuccessToast: false }).then(async (done) => {
            setRetrying((now) => new Set([...now].filter((id) => id !== sourceId)))
            if (done !== undefined)
                await mutate((key) => Array.isArray(key) && key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY)
        })
    }
    const reread = (sourceId: string) => {
        setRetrying((now) => new Set(now).add(sourceId))
        void runGraphQL(() => reindexSource({ sourceId }), { showSuccessToast: false }).then(async (done) => {
            setRetrying((now) => new Set([...now].filter((id) => id !== sourceId)))
            if (done !== undefined)
                await mutate((key) => Array.isArray(key) && key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY)
        })
    }
    const settled = (sourceId: string) => setRetrying((now) => new Set([...now].filter((id) => id !== sourceId)))
    const applyFacts = (sourceId: string) => {
        setRetrying((now) => new Set(now).add(sourceId))
        void runGraphQL(() => applyGroup({ sourceId }), { showSuccessToast: false }).then(async (done) => {
            settled(sourceId)
            if (done === undefined) return
            toast.success(t("bulkApplied", { applied: done.applied, skipped: done.skipped }))
            await mutate((key) => Array.isArray(key) && key[0] === QUERY_BRAIN_SWR_KEY)
        })
    }
    const undoFacts = (batchId: string, sourceId: string) => {
        setRetrying((now) => new Set(now).add(sourceId))
        void runGraphQL(() => undoBatch({ batchId }), { showSuccessToast: false }).then(async (done) => {
            settled(sourceId)
            if (done === undefined) return
            toast.success(t("bulkUndone", { restored: done.restored, kept: done.kept }))
            await mutate((key) => Array.isArray(key) && key[0] === QUERY_BRAIN_SWR_KEY)
        })
    }
    const decide = (key: string, state: IdeaDecision | null) => {
        void runGraphQL(() => decideSuggestion({ key, state }), { showSuccessToast: false }).then(async (done) => {
            if (done !== undefined)
                await mutate((key) => Array.isArray(key) && key[0] === QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY)
        })
    }
    return { retrying, isPending: isMutating, retry, reread, applyFacts, undoFacts, decide }
}

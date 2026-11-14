"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
    QUERY_BRAIN_CRITIQUE_SOURCES_SWR_KEY,
    QUERY_BRAIN_CRITIQUE_SWR_KEY,
    QUERY_BRAIN_FACTS_PAGE_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    useMutateAnswerBrainCritiqueSwr,
    useMutateReleaseBrainCritiqueSwr,
    useMutateRetryBrainCritiqueSwr,
    useMutateSkipBrainCritiqueSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { mutate } from "@/modules/viewer-cache"

/** The reads an answer, a skip or a release changes: the points, the documents with points, the facts they became, the brain and its to-do count. */
const CRITIQUE_READS: ReadonlySet<string> = new Set([
    QUERY_BRAIN_CRITIQUE_SWR_KEY,
    QUERY_BRAIN_CRITIQUE_SOURCES_SWR_KEY,
    QUERY_BRAIN_FACTS_PAGE_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
])

/** A cache key of one of those reads. */
const isCritiqueRead = (key: unknown): boolean =>
    Array.isArray(key) && typeof key[0] === "string" && CRITIQUE_READS.has(key[0])

/** What a block can ask of the critic's points; each command answers whether it went through and has toasted either way. */
export interface CritiqueCommands {
    /** The point a command is running for; null when none is. */
    readonly pendingId: string | null
    readonly isReleasing: boolean
    readonly isRetrying: boolean
    /** Answers a point with one of its choices; a typed choice sends its value. */
    readonly answer: (findingId: string, choiceId: string, value?: string) => Promise<boolean>
    /** Leaves a point alone: it goes out of the list without a fact. */
    readonly skip: (findingId: string) => Promise<boolean>
    /** Serves to customers the passages that only wait for the review. */
    readonly release: (sourceId: string) => Promise<boolean>
    /** Asks the critic to read the document again. */
    readonly retry: (sourceId: string) => Promise<boolean>
}

/**
 * The writes of the document critic: answer a point, skip it, serve the passages that wait for the review, read again. Every write
 * that went through reads the points, the documents list, the waiting facts and the to-do count again; the point answered leaves the list.
 */
export const useCritiqueCommands = (): CritiqueCommands => {
    const t = useTranslations("brainCritique")
    const run = useGraphQLWithToast()
    const answer = useMutateAnswerBrainCritiqueSwr()
    const skip = useMutateSkipBrainCritiqueSwr()
    const release = useMutateReleaseBrainCritiqueSwr()
    const retry = useMutateRetryBrainCritiqueSwr()
    const [pendingId, setPendingId] = useState<string | null>(null)
    const done = async <Answer>(action: () => Promise<Answer>, message: string): Promise<boolean> => {
        const result = await run(action, { successMessage: message })
        if (result === undefined) return false
        await mutate(isCritiqueRead)
        return true
    }
    const onPoint = async (findingId: string, action: () => Promise<unknown>, message: string): Promise<boolean> => {
        setPendingId(findingId)
        try {
            return await done(action, message)
        } finally {
            setPendingId(null)
        }
    }
    return {
        pendingId,
        isReleasing: release.isMutating,
        isRetrying: retry.isMutating,
        answer: (findingId, choiceId, value) =>
            onPoint(
                findingId,
                () => answer.trigger({ findingId, choiceId, ...(value === undefined ? {} : { value: value.trim() }) }),
                t("answered"),
            ),
        skip: (findingId) => onPoint(findingId, () => skip.trigger({ findingId }), t("skipped")),
        release: (sourceId) => done(() => release.trigger({ sourceId }), t("released")),
        retry: (sourceId) => done(() => retry.trigger({ sourceId }), t("retried")),
    }
}

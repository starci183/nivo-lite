"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import {
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY,
    useMutateApplyBrainFactGroupSwr,
    useMutateReindexKnowledgeSourceSwr,
    useMutateRetryKnowledgeSourceSwr,
    useMutateSetKnowledgeSuggestionStateSwr,
    useMutateUndoBrainFactBatchSwr,
} from "@/hooks/swr"
import { mutate } from "@/modules/viewer-cache"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { IdeaDecision } from "@/modules/types"

/** The actual write and the reads and outcome it makes authoritative. */
interface LibraryWrite<Result> {
    readonly key: string
    readonly action: string
    readonly execute: () => Promise<Result>
    readonly after: (result: Result) => void | Promise<unknown>
}

/** Refreshes exactly this workspace in the viewer's cache. */
const refreshLibrary = (workspaceId: string, names: readonly string[]) =>
    mutate(
        (key) => Array.isArray(key) && key[1] === workspaceId && typeof key[0] === "string" && names.includes(key[0]),
    )

/** The suggestion decision's declared action identifier. */
const suggestionActionOf = (state: IdeaDecision | null) => {
    if (state === null) return "restore"
    return state === "dismissed" ? "hide" : "na"
}

/** Source retry state excludes independently pending suggestion decisions. */
const retryingSourcesOf = (pending: Readonly<Record<string, string>>): ReadonlySet<string> =>
    new Set(Object.keys(pending).filter((key) => !key.startsWith("idea:")))

/** Each caller awaits its actual command and revalidation, and row data receives only the initiating action's identity. */
export const useLibraryCommands = () => {
    const workspace = useWorkspaceKey(QUERY_KNOWLEDGE_SOURCES_SWR_KEY, [])
    const runGraphQL = useGraphQLWithToast()
    const retrySource = useMutateRetryKnowledgeSourceSwr()
    const reindexSource = useMutateReindexKnowledgeSourceSwr()
    const decideSuggestion = useMutateSetKnowledgeSuggestionStateSwr()
    const applyGroup = useMutateApplyBrainFactGroupSwr()
    const undoBatch = useMutateUndoBrainFactBatchSwr()
    const t = useTranslations("knowledge")
    const feedback = useTranslations("toast")
    const [pending, setPending] = useState<Readonly<Record<string, string>>>({})
    const refresh = (names: readonly string[]) =>
        workspace === null ? Promise.resolve(undefined) : refreshLibrary(workspace[1], names)
    const run = async <Result>(write: LibraryWrite<Result>) => {
        if (workspace === null || pending[write.key] !== undefined) return undefined
        setPending((now) => ({ ...now, [write.key]: write.action }))
        try {
            const result = await runGraphQL(write.execute, { showSuccessToast: false })
            if (result === undefined) return undefined
            await write.after(result)
            return result
        } catch {
            toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
            return undefined
        } finally {
            setPending((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== write.key)))
        }
    }
    const retry = (sourceId: string) =>
        run({
            key: sourceId,
            action: "retry",
            execute: () => retrySource.trigger({ id: sourceId }),
            after: () => refresh([QUERY_KNOWLEDGE_SOURCES_SWR_KEY]),
        })
    const reread = (sourceId: string) =>
        run({
            key: sourceId,
            action: "retry-facts",
            execute: () => reindexSource.trigger({ sourceId }),
            after: () => refresh([QUERY_KNOWLEDGE_SOURCES_SWR_KEY]),
        })
    const applyFacts = (sourceId: string) =>
        run({
            key: sourceId,
            action: "apply-facts",
            execute: () => applyGroup.trigger({ sourceId }),
            after: async (done) => {
                toast.success(t("bulkApplied", { applied: done.applied, skipped: done.skipped }))
                await refresh([QUERY_BRAIN_SWR_KEY, QUERY_BRAIN_TODO_SWR_KEY])
            },
        })
    const undoFacts = (batchId: string, sourceId: string) =>
        run({
            key: sourceId,
            action: "undo-facts",
            execute: () => undoBatch.trigger({ batchId }),
            after: async (done) => {
                toast.success(t("bulkUndone", { restored: done.restored, kept: done.kept }))
                await refresh([QUERY_BRAIN_SWR_KEY, QUERY_BRAIN_TODO_SWR_KEY])
            },
        })
    const decide = (key: string, state: IdeaDecision | null) =>
        run({
            key: `idea:${key}`,
            action: suggestionActionOf(state),
            execute: () => decideSuggestion.trigger({ key, state }),
            after: () => refresh([QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY]),
        })
    return {
        pending,
        retrying: retryingSourcesOf(pending),
        isPending: Object.keys(pending).length > 0,
        retry,
        reread,
        applyFacts,
        undoFacts,
        decide,
    }
}

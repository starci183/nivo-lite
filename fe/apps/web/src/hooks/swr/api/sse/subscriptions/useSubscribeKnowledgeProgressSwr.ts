"use client"

import { useSWRConfig } from "swr"
import useSWRSubscription from "swr/subscription"
import { useViewerKeyId, useWorkspaceKey } from "@/hooks/workspaceKey"
import { streamKnowledgeProgress } from "@/modules/api/sse/knowledge/stream-knowledge-progress"
import type { KnowledgeProgressPush } from "@/modules/api/sse/knowledge/stream-knowledge-progress"
import { QUERY_BRAIN_SWR_KEY } from "../../graphql/queries/useQueryBrainSwr"
import { QUERY_KNOWLEDGE_SOURCES_SWR_KEY } from "../../graphql/queries/useQueryKnowledgeSourcesSwr"
import { QUERY_KNOWLEDGE_USAGE_SWR_KEY } from "../../graphql/queries/useQueryKnowledgeUsageSwr"

/** The SWR key of the knowledge-progress stream; the full key carries the workspace and the signed-in member, the identity of the stream. */
export const SUBSCRIBE_KNOWLEDGE_PROGRESS_SWR_KEY = "SUBSCRIBE_KNOWLEDGE_PROGRESS_SWR"

/** The key of the stream; null while nobody is signed in or no workspace is active. */
type KnowledgeProgressStreamKey = readonly [string, string, ...Array<string | null>] | null

/** What the subscription holds: whether the stream is open, and the newest pushed state of each source. */
export interface KnowledgeProgressState {
    /** True while the stream is open; false after it dropped, when the polling of the list takes over. */
    readonly isLive: boolean
    readonly bySource: Readonly<Record<string, KnowledgeProgressPush>>
}

/** A burst of settles reads the list once, this long after the last of them, so 200 settles are not 200 reads. */
const SETTLE_DEBOUNCE_MS = 1_000

const NOT_LIVE: KnowledgeProgressState = { isLive: false, bySource: {} }

/** The Second Brain is read this soon after a settle (a burst still reads it once): the settled document must not be drawn as unread meanwhile. */
const BRAIN_DEBOUNCE_MS = 250

/** The reads a settled source changes besides the Second Brain: the list and the raw data used. */
const SETTLED_READS: ReadonlySet<unknown> = new Set([QUERY_KNOWLEDGE_SOURCES_SWR_KEY, QUERY_KNOWLEDGE_USAGE_SWR_KEY])

/** Statuses after which a worker is no longer on the source: the stored list and the Second Brain are read again for what only they hold (the passage count, the note, the facts). */
const SETTLED: ReadonlySet<string> = new Set(["ready", "failed", "blocked_credits"])

/** The state with this push kept when it is newer than the one held for its source. */
const withPush = (state: KnowledgeProgressState, push: KnowledgeProgressPush): KnowledgeProgressState => {
    const held = state.bySource[push.sourceId]
    return held !== undefined && held.at > push.at
        ? state
        : { ...state, bySource: { ...state.bySource, [push.sourceId]: push } }
}

/**
 * The progress of the sources of the active workspace, pushed while a worker indexes them. Nobody signed in or no workspace, no
 * stream. Each (re)open reads the stored list once (the state comes from the database, never from the stream), a push that settles
 * a source reads it again, and a dropped stream flips `isLive` off so the polling of the list takes over until it reopens.
 */
export const useSubscribeKnowledgeProgressSwr = () => {
    const viewerId = useViewerKeyId()
    const { mutate } = useSWRConfig()
    const key = useWorkspaceKey(
        SUBSCRIBE_KNOWLEDGE_PROGRESS_SWR_KEY,
        [viewerId ?? null],
        viewerId !== undefined && viewerId !== "signed-out",
    )
    return useSWRSubscription<KnowledgeProgressState, Error, KnowledgeProgressStreamKey>(
        key,
        ([, workspaceId], { next }) => {
            const controller = new AbortController()
            let pending: ReturnType<typeof setTimeout> | undefined
            let brainPending: ReturnType<typeof setTimeout> | undefined
            const staleList = (read: unknown): boolean =>
                Array.isArray(read) && read[1] === workspaceId && SETTLED_READS.has(read[0])
            /** The Second Brain holds where the reading of the facts stands: it is read at once, so a document that settled is never drawn as unread. */
            const staleBrain = (read: unknown): boolean =>
                Array.isArray(read) && read[1] === workspaceId && read[0] === QUERY_BRAIN_SWR_KEY
            const refreshSoon = () => {
                clearTimeout(pending)
                pending = setTimeout(() => void mutate(staleList), SETTLE_DEBOUNCE_MS)
            }
            void streamKnowledgeProgress({
                signal: controller.signal,
                onOpen: () => {
                    next(null, (state) => ({ ...(state ?? NOT_LIVE), isLive: true }))
                    void mutate(staleList)
                    void mutate(staleBrain)
                },
                onPush: (push) => {
                    next(null, (state) => withPush(state ?? NOT_LIVE, push))
                    if (!SETTLED.has(push.status)) return
                    clearTimeout(brainPending)
                    brainPending = setTimeout(() => void mutate(staleBrain), BRAIN_DEBOUNCE_MS)
                    refreshSoon()
                },
                onDrop: () => next(null, (state) => ({ ...(state ?? NOT_LIVE), isLive: false })),
                report: (line) => next(new Error(line)),
            })
            return () => {
                controller.abort()
                clearTimeout(pending)
                clearTimeout(brainPending)
            }
        },
    )
}

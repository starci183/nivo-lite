"use client"

import { useMemo } from "react"
import { useQueryKnowledgeSourcesSwr, useSubscribeKnowledgeProgressSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { liveOf, overlayPush, toKnowledgeDocument } from "@/modules/documents"
import type { ModuleKey } from "@/modules/catalog"
import { readError } from "@/hooks/workspaceread"

/** How often the list is read while the stream is open: a check for a frame the stream lost. */
const LIVE_POLL_MS = 15_000

/**
 * The documents of the active workspace, in the shape the blocks know. While a worker is on a document its progress arrives on
 * the progress stream and is laid over the stored list; when the stream is not open the list polls as before.
 * `module` = "all" or undefined lists every document.
 */
export const useKnowledgeSources = (module?: ModuleKey | "all") => {
    const stream = useSubscribeKnowledgeProgressSwr()
    const pushed = stream.data?.bySource
    const swrRead = useQueryKnowledgeSourcesSwr(
        module === undefined || module === "all" ? {} : { module },
        stream.data?.isLive === true ? LIVE_POLL_MS : undefined,
    )
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const sources = useMemo(
        () => (data === undefined ? undefined : data.map((row) => overlayPush(toKnowledgeDocument(row), pushed?.[row.id]))),
        [data, pushed],
    )
    const live = useMemo(
        () =>
            Object.fromEntries(
                (sources ?? []).flatMap((source) => {
                    const state = liveOf(source, pushed?.[source.id])
                    return state === null ? [] : [[source.id, state]]
                }),
            ),
        [sources, pushed],
    )
    const slot = slotOfSwr({ data: sources, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { sources, live, error, isLoading, slot, reload }
}

"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import {
    queryKnowledgeSources,
    type QueryKnowledgeSourcesRequest,
} from "@/modules/api/graphql/queries/query-knowledge-sources"

/** The SWR key of the documents list; mutations that change it revalidate the keys that lead with it. */
export const QUERY_KNOWLEDGE_SOURCES_SWR_KEY = "QUERY_KNOWLEDGE_SOURCES_SWR"

/** The cache identity of the list: the workspace, the module filter and the origin filter. */
type SourcesKey = readonly [name: string, workspaceId: string, module: string | null, origin: string | null]

/** How often the list is asked again while a worker is on a document. */
const ACTIVE_POLL_MS = 3_000

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["pending", "queued", "reading", "indexing", "extracting_facts"])

/**
 * The documents of the active workspace, optionally filtered to one module or to the origin they came from (`google_drive`)
 * (the back end `knowledgeSources` query).
 * Polls while a worker is on a document (every `pollMs`: a slow check, which catches a frame the stream lost, while the progress
 * stream is open), so status and progress move on their own; nothing is read while `enabled` is false.
 */
export const useQueryKnowledgeSourcesSwr = (input?: QueryKnowledgeSourcesRequest, pollMs = ACTIVE_POLL_MS, enabled = true) => {
    const key = useWorkspaceKey(
        QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
        [input?.module ?? null, input?.origin ?? null],
        enabled,
    )
    return useSWR(
        key,
        async ([, , module, origin]: SourcesKey) => {
            const result = await queryKnowledgeSources({
                request: {
                    ...(module === null ? {} : { module }),
                    ...(origin === null ? {} : { origin }),
                },
            })
            if (!result.data) throw new Error("knowledgeSources answered no data")
            return result.data.knowledgeSources
        },
        {
            refreshInterval: (data) => (data?.some((one) => ACTIVE_STATUSES.has(one.status)) ? pollMs : 0),
        },
    )
}

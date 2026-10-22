"use client"

import { answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryMentionDirectory } from "@/modules/api/graphql/queries/query-mention-directory"

/** The SWR key of {@link useQueryMentionDirectorySwr}. */
export const QUERY_MENTION_DIRECTORY_SWR_KEY = "QUERY_MENTION_DIRECTORY_SWR"

/** The back end `mentionDirectory` query: who the composer can tag in the active workspace. */
export const useQueryMentionDirectorySwr = (config?: SWRConfiguration) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return useSWR(
        workspaceId === undefined ? null : ([QUERY_MENTION_DIRECTORY_SWR_KEY, workspaceId] as const),
        async () => answeredData(await queryMentionDirectory(), QUERY_MENTION_DIRECTORY_SWR_KEY).mentionDirectory,
        config,
    )
}

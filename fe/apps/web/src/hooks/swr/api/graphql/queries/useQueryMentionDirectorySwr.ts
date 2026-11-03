"use client"

import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryMentionDirectory } from "@/modules/api/graphql/queries/query-mention-directory"
import type { MentionDirectoryQuery } from "@/modules/api"

/** The SWR key of {@link useQueryMentionDirectorySwr}. */
export const QUERY_MENTION_DIRECTORY_SWR_KEY = "QUERY_MENTION_DIRECTORY_SWR"

/** The back end `mentionDirectory` query: who the composer can tag in the active workspace. */
export const useQueryMentionDirectorySwr = (
    config?: SWRConfiguration,
): ReadResponse<MentionDirectoryQuery["mentionDirectory"]> => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return useSWR(
        workspaceId === undefined ? null : ([QUERY_MENTION_DIRECTORY_SWR_KEY, workspaceId] as const),
        async () => answeredData(await queryMentionDirectory(), QUERY_MENTION_DIRECTORY_SWR_KEY).mentionDirectory,
        config,
    )
}

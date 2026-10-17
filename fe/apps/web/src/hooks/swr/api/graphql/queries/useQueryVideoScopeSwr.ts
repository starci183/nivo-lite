"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoScope } from "@/modules/api/graphql/queries/query-video-scope"

/** The SWR key of the videoScope query. */
export const QUERY_VIDEO_SCOPE_SWR_KEY = "QUERY_VIDEO_SCOPE_SWR"

/** What the video editor may use in the workspace. */
export const useQueryVideoScopeSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_SCOPE_SWR_KEY, [] as const),
        async ([, , ...input]: readonly [string, string]) =>
            answeredData(await queryVideoScope(), QUERY_VIDEO_SCOPE_SWR_KEY).videoScope,
    )

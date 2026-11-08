"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRResponse } from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoScope } from "@/modules/api/graphql/queries/query-video-scope"
import type { VideoScopeQuery } from "@/modules/api"

/** The SWR key of the videoScope query. */
export const QUERY_VIDEO_SCOPE_SWR_KEY = "QUERY_VIDEO_SCOPE_SWR"

/** What the video editor may use in the workspace. */
export const useQueryVideoScopeSwr = (isActive = true): SWRResponse<VideoScopeQuery["videoScope"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_SCOPE_SWR_KEY, isActive ? ([] as const) : null),
        async () => answeredData(await queryVideoScope(), QUERY_VIDEO_SCOPE_SWR_KEY).videoScope,
    )

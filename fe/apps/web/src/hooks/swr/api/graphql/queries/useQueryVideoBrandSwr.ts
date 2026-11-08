"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRResponse } from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoBrand } from "@/modules/api/graphql/queries/query-video-brand"
import type { VideoBrandQuery } from "@/modules/api"

/** The SWR key of the videoBrand query. */
export const QUERY_VIDEO_BRAND_SWR_KEY = "QUERY_VIDEO_BRAND_SWR"

/** The video brand of the workspace. */
export const useQueryVideoBrandSwr = (isActive = true): SWRResponse<VideoBrandQuery["videoBrand"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_BRAND_SWR_KEY, isActive ? ([] as const) : null),
        async () => answeredData(await queryVideoBrand(), QUERY_VIDEO_BRAND_SWR_KEY).videoBrand,
    )

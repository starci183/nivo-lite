"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoBrand } from "@/modules/api/graphql/queries/query-video-brand"

/** The SWR key of the videoBrand query. */
export const QUERY_VIDEO_BRAND_SWR_KEY = "QUERY_VIDEO_BRAND_SWR"

/** The video brand of the workspace. */
export const useQueryVideoBrandSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_BRAND_SWR_KEY, [] as const),
        async () => answeredData(await queryVideoBrand(), QUERY_VIDEO_BRAND_SWR_KEY).videoBrand,
    )

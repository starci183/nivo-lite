"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoSources } from "@/modules/api/graphql/queries/query-video-sources"

/** The SWR key of the videoSources query. */
export const QUERY_VIDEO_SOURCES_SWR_KEY = "QUERY_VIDEO_SOURCES_SWR"

/** The sources a video can draw from. */
export const useQueryVideoSourcesSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_SOURCES_SWR_KEY, [] as const),
        async () => answeredData(await queryVideoSources(), QUERY_VIDEO_SOURCES_SWR_KEY).videoSources,
    )

"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoMedia } from "@/modules/api/graphql/queries/query-video-media"
import type { VideoMediaQuery } from "@/modules/api"

/** The SWR key of the videoMedia query. */
export const QUERY_VIDEO_MEDIA_SWR_KEY = "QUERY_VIDEO_MEDIA_SWR"

/** The media library of the video editor. */
export const useQueryVideoMediaSwr = (isActive = true): SWRResponse<VideoMediaQuery["videoMedia"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_MEDIA_SWR_KEY, isActive ? ([] as const) : null),
        async () => answeredData(await queryVideoMedia(), QUERY_VIDEO_MEDIA_SWR_KEY).videoMedia,
    )

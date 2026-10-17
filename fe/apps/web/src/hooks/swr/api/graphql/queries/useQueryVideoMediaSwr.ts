"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoMedia } from "@/modules/api/graphql/queries/query-video-media"

/** The SWR key of the videoMedia query. */
export const QUERY_VIDEO_MEDIA_SWR_KEY = "QUERY_VIDEO_MEDIA_SWR"

/** The media library of the video editor. */
export const useQueryVideoMediaSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_MEDIA_SWR_KEY, [] as const),
        async ([, , ...input]: readonly [string, string]) =>
            answeredData(await queryVideoMedia(), QUERY_VIDEO_MEDIA_SWR_KEY).videoMedia,
    )

"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoFigures } from "@/modules/api/graphql/queries/query-video-figures"

/** The SWR key of the videoFigures query. */
export const QUERY_VIDEO_FIGURES_SWR_KEY = "QUERY_VIDEO_FIGURES_SWR"

/** The figures the video editor offers. */
export const useQueryVideoFiguresSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_FIGURES_SWR_KEY, [] as const),
        async ([, , ...input]: readonly [string, string]) =>
            answeredData(await queryVideoFigures(), QUERY_VIDEO_FIGURES_SWR_KEY).videoFigures,
    )

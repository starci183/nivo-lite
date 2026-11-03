"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryVideoFigures } from "@/modules/api/graphql/queries/query-video-figures"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the videoFigures query. */
export const QUERY_VIDEO_FIGURES_SWR_KEY = "QUERY_VIDEO_FIGURES_SWR"

/** The figures the video editor offers. */
export const useQueryVideoFiguresSwr = (
    isActive = true,
): ReadResponse<OperationData<typeof queryVideoFigures>["videoFigures"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_FIGURES_SWR_KEY, isActive ? ([] as const) : null),
        async () => answeredData(await queryVideoFigures(), QUERY_VIDEO_FIGURES_SWR_KEY).videoFigures,
    )

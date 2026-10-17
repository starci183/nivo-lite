"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { queryVideoProject } from "@/modules/api/graphql/queries/query-video-project"

/** The SWR key of the videoProject query. */
export const QUERY_VIDEO_PROJECT_SWR_KEY = "QUERY_VIDEO_PROJECT_SWR"

/** One video project, read again while it is scripting or rendering. */
export const useQueryVideoProjectSwr = (projectId: string | undefined) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_PROJECT_SWR_KEY, projectId ? ([projectId] as const) : null),
        async ([, , ...input]: WorkspaceReadKey<string>) =>
            answeredData(await queryVideoProject({ request: { projectId: input[0] } }), QUERY_VIDEO_PROJECT_SWR_KEY)
                .videoProject,
        {
            refreshInterval: (project) =>
                project?.status === "scripting" || project?.status === "rendering" ? 2000 : 0,
        },
    )

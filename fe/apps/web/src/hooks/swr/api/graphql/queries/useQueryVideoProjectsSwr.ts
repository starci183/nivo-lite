"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { queryVideoProjects } from "@/modules/api/graphql/queries/query-video-projects"

/** The SWR key of the videoProjects query. */
export const QUERY_VIDEO_PROJECTS_SWR_KEY = "QUERY_VIDEO_PROJECTS_SWR"

/** The video projects, read again while one is scripting or rendering. */
export const useQueryVideoProjectsSwr = (includeArchived = false) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_VIDEO_PROJECTS_SWR_KEY, [includeArchived] as const),
        async ([, , ...input]: WorkspaceReadKey<NonNullable<typeof includeArchived>>) =>
            answeredData(
                await queryVideoProjects({ request: { includeArchived: input[0] } }),
                QUERY_VIDEO_PROJECTS_SWR_KEY,
            ).videoProjects,
        {
            refreshInterval: (projects) =>
                projects?.some((project) => project.status === "scripting" || project.status === "rendering")
                    ? 2000
                    : 0,
        },
    )

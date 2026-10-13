import { queryVideoProjects } from "@/modules/api/graphql/queries/query-video-projects"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the videoProjects query. */
export const QUERY_VIDEO_PROJECTS_SWR_KEY = "QUERY_VIDEO_PROJECTS_SWR"

/** The video projects, read again while one is scripting or rendering. */
export const useQueryVideoProjectsSwr = (includeArchived = false) =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_PROJECTS_SWR_KEY,
        [includeArchived],
        ([archived]) => queryVideoProjects({ request: { includeArchived: archived } }),
        (data) => data.videoProjects,
        {
            refreshInterval: (projects) =>
                projects?.some((project) => project.status === "scripting" || project.status === "rendering")
                    ? 2000
                    : 0,
        },
    )

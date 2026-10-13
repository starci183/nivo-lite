import { queryVideoProject } from "@/modules/api/graphql/queries/query-video-project"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the videoProject query. */
export const QUERY_VIDEO_PROJECT_SWR_KEY = "QUERY_VIDEO_PROJECT_SWR"

/** One video project, read again while it is scripting or rendering. */
export const useQueryVideoProjectSwr = (projectId: string | undefined) =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_PROJECT_SWR_KEY,
        projectId ? [projectId] : null,
        ([id]) => queryVideoProject({ request: { projectId: id } }),
        (data) => data.videoProject,
        {
            refreshInterval: (project) =>
                project?.status === "scripting" || project?.status === "rendering" ? 2000 : 0,
        },
    )

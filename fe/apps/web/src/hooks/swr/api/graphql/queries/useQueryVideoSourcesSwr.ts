import { queryVideoSources } from "@/modules/api/graphql/queries/query-video-sources"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the videoSources query. */
export const QUERY_VIDEO_SOURCES_SWR_KEY = "QUERY_VIDEO_SOURCES_SWR"

/** The sources a video can draw from. */
export const useQueryVideoSourcesSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_SOURCES_SWR_KEY,
        [],
        () => queryVideoSources(),
        (data) => data.videoSources,
    )

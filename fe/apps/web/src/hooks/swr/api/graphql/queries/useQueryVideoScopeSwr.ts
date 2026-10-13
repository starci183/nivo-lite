import { queryVideoScope } from "@/modules/api/graphql/queries/query-video-scope"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables"

/** The SWR key of the videoScope query. */
export const QUERY_VIDEO_SCOPE_SWR_KEY = "QUERY_VIDEO_SCOPE_SWR"

/** What the video editor may use in the workspace. */
export const useQueryVideoScopeSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_SCOPE_SWR_KEY,
        [],
        () => queryVideoScope(),
        (data) => data.videoScope,
    )

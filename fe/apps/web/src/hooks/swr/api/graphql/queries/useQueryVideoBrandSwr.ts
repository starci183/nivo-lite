import { queryVideoBrand } from "@/modules/api/graphql/queries/query-video-brand"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the videoBrand query. */
export const QUERY_VIDEO_BRAND_SWR_KEY = "QUERY_VIDEO_BRAND_SWR"

/** The video brand of the workspace. */
export const useQueryVideoBrandSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_BRAND_SWR_KEY,
        [],
        () => queryVideoBrand(),
        (data) => data.videoBrand,
    )

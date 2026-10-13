import { queryVideoMedia } from "@/modules/api/graphql/queries/query-video-media"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables"

/** The SWR key of the videoMedia query. */
export const QUERY_VIDEO_MEDIA_SWR_KEY = "QUERY_VIDEO_MEDIA_SWR"

/** The media library of the video editor. */
export const useQueryVideoMediaSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_MEDIA_SWR_KEY,
        [],
        () => queryVideoMedia(),
        (data) => data.videoMedia,
    )

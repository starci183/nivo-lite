import { queryVideoFigures } from "@/modules/api/graphql/queries/query-video-figures"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the videoFigures query. */
export const QUERY_VIDEO_FIGURES_SWR_KEY = "QUERY_VIDEO_FIGURES_SWR"

/** The figures the video editor offers. */
export const useQueryVideoFiguresSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_VIDEO_FIGURES_SWR_KEY,
        [],
        () => queryVideoFigures(),
        (data) => data.videoFigures,
    )

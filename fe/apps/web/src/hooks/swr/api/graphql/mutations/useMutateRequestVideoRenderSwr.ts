import { mutateRequestVideoRender } from "@/modules/api/graphql/mutations/mutation-request-video-render"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestVideoRender mutation. */
export const MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY = "MUTATE_REQUEST_VIDEO_RENDER_SWR"

/** SWR mutation for {@link mutateRequestVideoRender}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestVideoRenderSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY,
        mutateRequestVideoRender,
        (data) => data.requestVideoRender,
    )

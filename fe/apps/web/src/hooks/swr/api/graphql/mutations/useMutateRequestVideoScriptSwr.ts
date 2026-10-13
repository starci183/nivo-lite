import { mutateRequestVideoScript } from "@/modules/api/graphql/mutations/mutation-request-video-script"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the requestVideoScript mutation. */
export const MUTATE_REQUEST_VIDEO_SCRIPT_SWR_KEY = "MUTATE_REQUEST_VIDEO_SCRIPT_SWR"

/** SWR mutation for {@link mutateRequestVideoScript}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestVideoScriptSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_VIDEO_SCRIPT_SWR_KEY,
        mutateRequestVideoScript,
        (data) => data.requestVideoScript,
    )

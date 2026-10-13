import { mutateUpdateVideoProject } from "@/modules/api/graphql/mutations/mutation-update-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the updateVideoProject mutation. */
export const MUTATE_UPDATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_UPDATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateUpdateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateVideoProjectSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_UPDATE_VIDEO_PROJECT_SWR_KEY,
        mutateUpdateVideoProject,
        (data) => data.updateVideoProject,
    )

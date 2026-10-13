import { mutateDuplicateVideoProject } from "@/modules/api/graphql/mutations/mutation-duplicate-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the duplicateVideoProject mutation. */
export const MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_DUPLICATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateDuplicateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDuplicateVideoProjectSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY,
        mutateDuplicateVideoProject,
        (data) => data.duplicateVideoProject,
    )

import { mutateCreateVideoProject } from "@/modules/api/graphql/mutations/mutation-create-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the createVideoProject mutation. */
export const MUTATE_CREATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_CREATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateCreateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateVideoProjectSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_CREATE_VIDEO_PROJECT_SWR_KEY,
        mutateCreateVideoProject,
        (data) => data.createVideoProject,
    )

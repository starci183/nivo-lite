import { mutateShareVideoProject } from "@/modules/api/graphql/mutations/mutation-share-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the shareVideoProject mutation. */
export const MUTATE_SHARE_VIDEO_PROJECT_SWR_KEY = "MUTATE_SHARE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateShareVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateShareVideoProjectSwr = () =>
    useGraphQLMutationSwr(MUTATE_SHARE_VIDEO_PROJECT_SWR_KEY, mutateShareVideoProject, (data) => data.shareVideoProject)

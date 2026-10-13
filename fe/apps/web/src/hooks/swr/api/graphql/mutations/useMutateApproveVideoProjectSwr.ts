import { mutateApproveVideoProject } from "@/modules/api/graphql/mutations/mutation-approve-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the approveVideoProject mutation. */
export const MUTATE_APPROVE_VIDEO_PROJECT_SWR_KEY = "MUTATE_APPROVE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateApproveVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateApproveVideoProjectSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_APPROVE_VIDEO_PROJECT_SWR_KEY,
        mutateApproveVideoProject,
        (data) => data.approveVideoProject,
    )

import { mutateSubmitContentForApproval } from "@/modules/api/graphql/mutations/mutation-submit-content-for-approval"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the submitContentForApproval mutation. */
export const MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR_KEY = "MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR"

/** SWR mutation for {@link mutateSubmitContentForApproval}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitContentForApprovalSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR_KEY,
        mutateSubmitContentForApproval,
        (data) => data.submitContentForApproval,
    )

import { mutateApproveLeadGenComment } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the approveLeadGenComment mutation. */
export const MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY = "MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR"

/** SWR mutation for {@link mutateApproveLeadGenComment}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateApproveLeadGenCommentSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY,
        mutateApproveLeadGenComment,
        (data) => data.approveLeadGenComment,
    )

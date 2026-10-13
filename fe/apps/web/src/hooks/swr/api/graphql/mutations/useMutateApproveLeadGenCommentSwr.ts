import useSWRMutation from "swr/mutation"
import { mutateApproveLeadGenComment } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"
import type { MutateApproveLeadGenCommentRequest } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"

/** What the approveLeadGenComment mutation is triggered with. */
interface ApproveLeadGenCommentArg {
    readonly arg: MutateApproveLeadGenCommentRequest
}

/** The SWR key of the approveLeadGenComment mutation. */
export const MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY = "MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR"

/** SWR mutation for {@link mutateApproveLeadGenComment}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateApproveLeadGenCommentSwr = () =>
    useSWRMutation(MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY, async (_key: string, { arg }: ApproveLeadGenCommentArg) => {
        const result = await mutateApproveLeadGenComment({ request: arg })
        if (!result.data) throw new Error("approveLeadGenComment answered no data")
        return result.data.approveLeadGenComment
    })

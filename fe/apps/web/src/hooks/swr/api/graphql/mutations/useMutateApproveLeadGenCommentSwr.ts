"use client"

import { mutateApproveLeadGenComment } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"
import type { MutateApproveLeadGenCommentRequest } from "@/modules/api/graphql/mutations/mutation-approve-lead-gen-comment"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the approveLeadGenComment mutation. */
export const MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY = "MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR"

/** SWR mutation for {@link mutateApproveLeadGenComment}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateApproveLeadGenCommentSwr = () =>
    useSWRMutation(
        MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateApproveLeadGenComment({ request: arg }), MUTATE_APPROVE_LEAD_GEN_COMMENT_SWR_KEY)
                .approveLeadGenComment,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateApproveLeadGenCommentRequest
}

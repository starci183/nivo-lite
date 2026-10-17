"use client"

import { mutateSubmitContentForApproval } from "@/modules/api/graphql/mutations/mutation-submit-content-for-approval"
import type { mutateSubmitContentForApproval as MutateSubmitContentForApprovalOperation } from "@/modules/api/graphql/mutations/mutation-submit-content-for-approval"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the submitContentForApproval mutation. */
export const MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR_KEY = "MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR"

/** SWR mutation for {@link mutateSubmitContentForApproval}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitContentForApprovalSwr = () =>
    useSWRMutation(
        MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateSubmitContentForApproval({ request: arg }),
                MUTATE_SUBMIT_CONTENT_FOR_APPROVAL_SWR_KEY,
            ).submitContentForApproval,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSubmitContentForApprovalOperation>[0]["request"]
}

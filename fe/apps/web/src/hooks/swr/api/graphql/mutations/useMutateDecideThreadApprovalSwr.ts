"use client"

import useSWRMutation from "swr/mutation"
import { mutateDecideThreadApproval } from "@/modules/api/graphql/mutations/mutation-decide-thread-approval"
import type { MutateDecideThreadApprovalRequest } from "@/modules/api/graphql/mutations/mutation-decide-thread-approval"

/** What the DecideThreadApproval mutation is triggered with. */
interface DecideThreadApprovalArg {
    readonly arg: MutateDecideThreadApprovalRequest
}

/** The SWR key of {@link useMutateDecideThreadApprovalSwr}. */
export const MUTATE_DECIDE_THREAD_APPROVAL_SWR_KEY = "MUTATE_DECIDE_THREAD_APPROVAL_SWR"

/** SWR mutation for {@link mutateDecideThreadApproval}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDecideThreadApprovalSwr = () =>
    useSWRMutation(MUTATE_DECIDE_THREAD_APPROVAL_SWR_KEY, async (_key: string, { arg }: DecideThreadApprovalArg) => {
        const result = await mutateDecideThreadApproval({ request: arg })
        if (!result.data) throw new Error("decideThreadApproval answered no data")
        return result.data.decideThreadApproval
    })

"use client"

import {
    mutateSetSandboxNextCase,
    type MutateSetSandboxNextCaseRequest,
} from "@/modules/api/graphql/mutations/mutation-set-sandbox-next-case"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SetSandboxNextCaseMutation } from "@/modules/api"

/** The SWR key of the setSandboxNextCase mutation. */
export const MUTATE_SET_SANDBOX_NEXT_CASE_SWR_KEY = "MUTATE_SET_SANDBOX_NEXT_CASE_SWR"

/** SWR mutation for {@link mutateSetSandboxNextCase}: Chooses the case an outbound operation of a sandbox account answers next. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetSandboxNextCaseSwr = (): SWRMutationResponse<
    SetSandboxNextCaseMutation["setSandboxNextCase"],
    Error,
    typeof MUTATE_SET_SANDBOX_NEXT_CASE_SWR_KEY,
    MutateSetSandboxNextCaseRequest
> =>
    useSWRMutation(
        MUTATE_SET_SANDBOX_NEXT_CASE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetSandboxNextCase({ request: arg }), MUTATE_SET_SANDBOX_NEXT_CASE_SWR_KEY).setSandboxNextCase,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSetSandboxNextCaseRequest
}

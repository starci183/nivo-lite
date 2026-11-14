"use client"

import {
    mutateDetachSandboxAccount,
    type MutateDetachSandboxAccountRequest,
} from "@/modules/api/graphql/mutations/mutation-detach-sandbox-account"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { DetachSandboxAccountMutation } from "@/modules/api"

/** The SWR key of the detachSandboxAccount mutation. */
export const MUTATE_DETACH_SANDBOX_ACCOUNT_SWR_KEY = "MUTATE_DETACH_SANDBOX_ACCOUNT_SWR"

/** SWR mutation for {@link mutateDetachSandboxAccount}: Takes a sandbox account away from an agent. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDetachSandboxAccountSwr = (): SWRMutationResponse<
    DetachSandboxAccountMutation["detachSandboxAccount"],
    Error,
    typeof MUTATE_DETACH_SANDBOX_ACCOUNT_SWR_KEY,
    MutateDetachSandboxAccountRequest
> =>
    useSWRMutation(
        MUTATE_DETACH_SANDBOX_ACCOUNT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDetachSandboxAccount({ request: arg }), MUTATE_DETACH_SANDBOX_ACCOUNT_SWR_KEY).detachSandboxAccount,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateDetachSandboxAccountRequest
}

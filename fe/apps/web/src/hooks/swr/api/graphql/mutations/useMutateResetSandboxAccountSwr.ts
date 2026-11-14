"use client"

import {
    mutateResetSandboxAccount,
    type MutateResetSandboxAccountRequest,
} from "@/modules/api/graphql/mutations/mutation-reset-sandbox-account"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ResetSandboxAccountMutation } from "@/modules/api"

/** The SWR key of the resetSandboxAccount mutation. */
export const MUTATE_RESET_SANDBOX_ACCOUNT_SWR_KEY = "MUTATE_RESET_SANDBOX_ACCOUNT_SWR"

/** SWR mutation for {@link mutateResetSandboxAccount}: Clears the call log and the state of a sandbox account. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateResetSandboxAccountSwr = (): SWRMutationResponse<
    ResetSandboxAccountMutation["resetSandboxAccount"],
    Error,
    typeof MUTATE_RESET_SANDBOX_ACCOUNT_SWR_KEY,
    MutateResetSandboxAccountRequest
> =>
    useSWRMutation(
        MUTATE_RESET_SANDBOX_ACCOUNT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateResetSandboxAccount({ request: arg }), MUTATE_RESET_SANDBOX_ACCOUNT_SWR_KEY).resetSandboxAccount,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateResetSandboxAccountRequest
}

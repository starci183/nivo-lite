"use client"

import {
    mutateOpenSandboxAccount,
    type MutateOpenSandboxAccountRequest,
} from "@/modules/api/graphql/mutations/mutation-open-sandbox-account"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { OpenSandboxAccountMutation } from "@/modules/api"

/** The SWR key of the openSandboxAccount mutation. */
export const MUTATE_OPEN_SANDBOX_ACCOUNT_SWR_KEY = "MUTATE_OPEN_SANDBOX_ACCOUNT_SWR"

/** SWR mutation for {@link mutateOpenSandboxAccount}: Opens a sandbox account of a provider. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateOpenSandboxAccountSwr = (): SWRMutationResponse<
    OpenSandboxAccountMutation["openSandboxAccount"],
    Error,
    typeof MUTATE_OPEN_SANDBOX_ACCOUNT_SWR_KEY,
    MutateOpenSandboxAccountRequest
> =>
    useSWRMutation(
        MUTATE_OPEN_SANDBOX_ACCOUNT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateOpenSandboxAccount({ request: arg }), MUTATE_OPEN_SANDBOX_ACCOUNT_SWR_KEY).openSandboxAccount,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateOpenSandboxAccountRequest
}

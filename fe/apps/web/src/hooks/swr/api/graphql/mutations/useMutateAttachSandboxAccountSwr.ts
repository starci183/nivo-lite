"use client"

import {
    mutateAttachSandboxAccount,
    type MutateAttachSandboxAccountRequest,
} from "@/modules/api/graphql/mutations/mutation-attach-sandbox-account"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { AttachSandboxAccountMutation } from "@/modules/api"

/** The SWR key of the attachSandboxAccount mutation. */
export const MUTATE_ATTACH_SANDBOX_ACCOUNT_SWR_KEY = "MUTATE_ATTACH_SANDBOX_ACCOUNT_SWR"

/** SWR mutation for {@link mutateAttachSandboxAccount}: Gives a sandbox account to an agent. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateAttachSandboxAccountSwr = (): SWRMutationResponse<
    AttachSandboxAccountMutation["attachSandboxAccount"],
    Error,
    typeof MUTATE_ATTACH_SANDBOX_ACCOUNT_SWR_KEY,
    MutateAttachSandboxAccountRequest
> =>
    useSWRMutation(
        MUTATE_ATTACH_SANDBOX_ACCOUNT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAttachSandboxAccount({ request: arg }), MUTATE_ATTACH_SANDBOX_ACCOUNT_SWR_KEY).attachSandboxAccount,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateAttachSandboxAccountRequest
}

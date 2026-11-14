"use client"

import {
    mutateExpireSandboxWait,
    type MutateExpireSandboxWaitRequest,
} from "@/modules/api/graphql/mutations/mutation-expire-sandbox-wait"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ExpireSandboxWaitMutation } from "@/modules/api"

/** The SWR key of the expireSandboxWait mutation. */
export const MUTATE_EXPIRE_SANDBOX_WAIT_SWR_KEY = "MUTATE_EXPIRE_SANDBOX_WAIT_SWR"

/** SWR mutation for {@link mutateExpireSandboxWait}: Ends the wait a run is parked at now, through the real deadline road. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateExpireSandboxWaitSwr = (): SWRMutationResponse<
    ExpireSandboxWaitMutation["expireSandboxWait"],
    Error,
    typeof MUTATE_EXPIRE_SANDBOX_WAIT_SWR_KEY,
    MutateExpireSandboxWaitRequest
> =>
    useSWRMutation(
        MUTATE_EXPIRE_SANDBOX_WAIT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateExpireSandboxWait({ request: arg }), MUTATE_EXPIRE_SANDBOX_WAIT_SWR_KEY).expireSandboxWait,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateExpireSandboxWaitRequest
}

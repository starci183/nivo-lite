"use client"

import {
    mutateSetDefaultReceivingAccount,
    type MutateSetDefaultReceivingAccountRequest,
} from "@/modules/api/graphql/mutations/mutation-set-default-receiving-account"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the setDefaultReceivingAccount mutation. */
export const MUTATE_SET_DEFAULT_RECEIVING_ACCOUNT_SWR_KEY = "MUTATE_SET_DEFAULT_RECEIVING_ACCOUNT_SWR"

/** SWR mutation for {@link mutateSetDefaultReceivingAccount}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetDefaultReceivingAccountSwr = (): SWRMutationResponse<
    boolean,
    Error,
    typeof MUTATE_SET_DEFAULT_RECEIVING_ACCOUNT_SWR_KEY,
    MutateSetDefaultReceivingAccountRequest
> =>
    useSWRMutation(
        MUTATE_SET_DEFAULT_RECEIVING_ACCOUNT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateSetDefaultReceivingAccount({ request: arg }),
                MUTATE_SET_DEFAULT_RECEIVING_ACCOUNT_SWR_KEY,
            ).setDefaultReceivingAccount,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSetDefaultReceivingAccountRequest
}

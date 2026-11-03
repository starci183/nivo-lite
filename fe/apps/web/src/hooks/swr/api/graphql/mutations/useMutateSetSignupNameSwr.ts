"use client"

import { mutateSetSignupName } from "@/modules/api/graphql/mutations/mutation-set-signup-name"
import type { mutateSetSignupName as MutateSetSignupNameOperation } from "@/modules/api/graphql/mutations/mutation-set-signup-name"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the setSignupName mutation. */
export const MUTATE_SET_SIGNUP_NAME_SWR_KEY = "MUTATE_SET_SIGNUP_NAME_SWR"

/** SWR mutation for {@link mutateSetSignupName}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetSignupNameSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSetSignupName>["setSignupName"],
    Error,
    typeof MUTATE_SET_SIGNUP_NAME_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_SIGNUP_NAME_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetSignupName({ request: arg }), MUTATE_SET_SIGNUP_NAME_SWR_KEY).setSignupName,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetSignupNameOperation>[0]["request"]
}

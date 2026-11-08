"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateReturnZaloAuthorization,
    type MutateReturnZaloAuthorizationRequest,
} from "@/modules/api/graphql/mutations/mutation-return-zalo-authorization"
import type { ReturnZaloAuthorizationMutation } from "@/modules/api"

/** What the returnZaloAuthorization mutation is triggered with. */
interface ReturnZaloAuthorizationArg {
    readonly arg: MutateReturnZaloAuthorizationRequest
}

/** The SWR key of the returnZaloAuthorization mutation. */
export const MUTATE_RETURN_ZALO_AUTHORIZATION_SWR_KEY = "MUTATE_RETURN_ZALO_AUTHORIZATION_SWR"

/** SWR mutation for {@link mutateReturnZaloAuthorization}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateReturnZaloAuthorizationSwr = (): SWRMutationResponse<
    ReturnZaloAuthorizationMutation["returnZaloAuthorization"],
    Error,
    typeof MUTATE_RETURN_ZALO_AUTHORIZATION_SWR_KEY,
    ReturnZaloAuthorizationArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RETURN_ZALO_AUTHORIZATION_SWR_KEY,
        async (_key: string, { arg }: ReturnZaloAuthorizationArg) => {
            const result = await mutateReturnZaloAuthorization({ request: arg })
            if (result.data === undefined) throw new Error("returnZaloAuthorization answered no data")
            return result.data.returnZaloAuthorization
        },
    )

"use client"

import useSWRMutation from "swr/mutation"
import { mutateVerifyLoyaltyCode } from "@/modules/api/graphql/mutations/mutation-verify-loyalty-code"
import type { MutateVerifyLoyaltyCodeRequest } from "@/modules/api/graphql/mutations/types/verify-loyalty-code"

/** The SWR key of the `verifyLoyaltyCode` mutation. */
export const MUTATE_VERIFY_LOYALTY_CODE_SWR_KEY = "MUTATE_VERIFY_LOYALTY_CODE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateVerifyLoyaltyCodeRequest
}

/** Verifies the typed code and unlocks the customer's points and rewards. */
export const useMutateVerifyLoyaltyCodeSwr = () =>
    useSWRMutation(MUTATE_VERIFY_LOYALTY_CODE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateVerifyLoyaltyCode({ request: arg })
        if (!result.data) throw new Error("verifyLoyaltyCode answered no data")
        return result.data.verifyLoyaltyCode
    })

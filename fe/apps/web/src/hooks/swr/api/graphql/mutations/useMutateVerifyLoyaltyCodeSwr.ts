import useSWRMutation from "swr/mutation"
import { mutateVerifyLoyaltyCode } from "@/modules/api/graphql/mutations"
import type { MutateVerifyLoyaltyCodeRequest } from "@/modules/api/graphql/mutations/types/verify-loyalty-code"

/** The SWR key of the `verifyLoyaltyCode` mutation. */
export const MUTATE_VERIFY_LOYALTY_CODE_SWR_KEY = "MUTATE_VERIFY_LOYALTY_CODE_SWR"

/** Verifies the typed code and unlocks the customer's points and rewards. */
export const useMutateVerifyLoyaltyCodeSwr = () =>
    useSWRMutation(MUTATE_VERIFY_LOYALTY_CODE_SWR_KEY, async (_key: string, { arg }: { arg: MutateVerifyLoyaltyCodeRequest }) => {
        const result = await mutateVerifyLoyaltyCode({ request: arg })
        if (!result.data) throw new Error("verifyLoyaltyCode answered no data")
        return result.data.verifyLoyaltyCode
    })

import useSWRMutation from "swr/mutation"
import { mutateRequestLoyaltyCode } from "@/modules/api/graphql/mutations"
import type { MutateRequestLoyaltyCodeRequest } from "@/modules/api/graphql/mutations/types/request-loyalty-code"

/** The SWR key of the `requestLoyaltyCode` mutation. */
export const MUTATE_REQUEST_LOYALTY_CODE_SWR_KEY = "MUTATE_REQUEST_LOYALTY_CODE_SWR"

/** Asks the back end to send the verification code to the customer's own chat. */
export const useMutateRequestLoyaltyCodeSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_LOYALTY_CODE_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateRequestLoyaltyCodeRequest }) => {
            const result = await mutateRequestLoyaltyCode({ request: arg })
            if (!result.data) throw new Error("requestLoyaltyCode answered no data")
            return result.data.requestLoyaltyCode
        },
    )

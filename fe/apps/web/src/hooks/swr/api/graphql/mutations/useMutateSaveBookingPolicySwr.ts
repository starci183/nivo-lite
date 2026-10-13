import useSWRMutation from "swr/mutation"
import { mutateSaveBookingPolicy } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingPolicyRequest } from "@/modules/api/graphql/mutations/types/save-booking-policy"

/** The SWR key of the `saveBookingPolicy` mutation. */
export const MUTATE_SAVE_BOOKING_POLICY_SWR_KEY = "MUTATE_SAVE_BOOKING_POLICY_SWR"

/** Saves the cancellation, deposit and slot rules of the workspace. */
export const useMutateSaveBookingPolicySwr = () =>
    useSWRMutation(
        MUTATE_SAVE_BOOKING_POLICY_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateSaveBookingPolicyRequest }) => {
            const result = await mutateSaveBookingPolicy({ request: arg })
            if (!result.data) throw new Error("saveBookingPolicy answered no data")
            return result.data.saveBookingPolicy
        },
    )

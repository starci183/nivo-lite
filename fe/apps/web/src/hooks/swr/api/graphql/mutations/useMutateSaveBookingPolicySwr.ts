import useSWRMutation from "swr/mutation"
import { mutateSaveBookingPolicy } from "@/modules/api/graphql/mutations/mutation-save-booking-policy"
import type { MutateSaveBookingPolicyRequest } from "@/modules/api/graphql/mutations/types/save-booking-policy"

/** The SWR key of the `saveBookingPolicy` mutation. */
export const MUTATE_SAVE_BOOKING_POLICY_SWR_KEY = "MUTATE_SAVE_BOOKING_POLICY_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveBookingPolicyRequest
}

/** Saves the cancellation, deposit and slot rules of the workspace. */
export const useMutateSaveBookingPolicySwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_POLICY_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveBookingPolicy({ request: arg })
        if (!result.data) throw new Error("saveBookingPolicy answered no data")
        return result.data.saveBookingPolicy
    })

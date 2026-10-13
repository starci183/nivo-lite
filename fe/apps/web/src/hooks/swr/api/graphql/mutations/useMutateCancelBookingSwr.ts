import useSWRMutation from "swr/mutation"
import { mutateCancelBooking } from "@/modules/api/graphql/mutations/mutation-cancel-booking"
import type { MutateCancelBookingRequest } from "@/modules/api/graphql/mutations/types/cancel-booking"

/** The SWR key of the `cancelBooking` mutation. */
export const MUTATE_CANCEL_BOOKING_SWR_KEY = "MUTATE_CANCEL_BOOKING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateCancelBookingRequest
}

/** Cancels a booking. */
export const useMutateCancelBookingSwr = () =>
    useSWRMutation(MUTATE_CANCEL_BOOKING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateCancelBooking({ request: arg })
        if (!result.data) throw new Error("cancelBooking answered no data")
        return result.data.cancelBooking
    })

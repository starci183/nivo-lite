import useSWRMutation from "swr/mutation"
import { mutateCompleteBooking } from "@/modules/api/graphql/mutations"
import type { MutateCompleteBookingRequest } from "@/modules/api/graphql/mutations/types/complete-booking"

/** The SWR key of the `completeBooking` mutation. */
export const MUTATE_COMPLETE_BOOKING_SWR_KEY = "MUTATE_COMPLETE_BOOKING_SWR"

/** Marks a booking done. */
export const useMutateCompleteBookingSwr = () =>
    useSWRMutation(MUTATE_COMPLETE_BOOKING_SWR_KEY, async (_key: string, { arg }: { arg: MutateCompleteBookingRequest }) => {
        const result = await mutateCompleteBooking({ request: arg })
        if (!result.data) throw new Error("completeBooking answered no data")
        return result.data.completeBooking
    })

import useSWRMutation from "swr/mutation"
import { mutateCheckInBooking } from "@/modules/api/graphql/mutations"
import type { MutateCheckInBookingRequest } from "@/modules/api/graphql/mutations/types/check-in-booking"

/** The SWR key of the `checkInBooking` mutation. */
export const MUTATE_CHECK_IN_BOOKING_SWR_KEY = "MUTATE_CHECK_IN_BOOKING_SWR"

/** Checks a confirmed booking in. */
export const useMutateCheckInBookingSwr = () =>
    useSWRMutation(MUTATE_CHECK_IN_BOOKING_SWR_KEY, async (_key: string, { arg }: { arg: MutateCheckInBookingRequest }) => {
        const result = await mutateCheckInBooking({ request: arg })
        if (!result.data) throw new Error("checkInBooking answered no data")
        return result.data.checkInBooking
    })

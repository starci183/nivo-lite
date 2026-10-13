import useSWRMutation from "swr/mutation"
import { mutateMarkBookingNoShow } from "@/modules/api/graphql/mutations"
import type { MutateMarkBookingNoShowRequest } from "@/modules/api/graphql/mutations/types/mark-booking-no-show"

/** The SWR key of the `markBookingNoShow` mutation. */
export const MUTATE_MARK_BOOKING_NO_SHOW_SWR_KEY = "MUTATE_MARK_BOOKING_NO_SHOW_SWR"

/** Marks a booking as a no-show. */
export const useMutateMarkBookingNoShowSwr = () =>
    useSWRMutation(MUTATE_MARK_BOOKING_NO_SHOW_SWR_KEY, async (_key: string, { arg }: { arg: MutateMarkBookingNoShowRequest }) => {
        const result = await mutateMarkBookingNoShow({ request: arg })
        if (!result.data) throw new Error("markBookingNoShow answered no data")
        return result.data.markBookingNoShow
    })

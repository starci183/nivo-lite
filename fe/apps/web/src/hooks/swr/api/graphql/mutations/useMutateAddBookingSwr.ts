import useSWRMutation from "swr/mutation"
import { mutateAddBooking } from "@/modules/api/graphql/mutations"
import type { MutateAddBookingRequest } from "@/modules/api/graphql/mutations/types/add-booking"

/** The SWR key of the `addBooking` mutation. */
export const MUTATE_ADD_BOOKING_SWR_KEY = "MUTATE_ADD_BOOKING_SWR"

/** Places a booking on the desk (auto-assigns a resource when resourceId is empty; force stacks over a refusal). */
export const useMutateAddBookingSwr = () =>
    useSWRMutation(MUTATE_ADD_BOOKING_SWR_KEY, async (_key: string, { arg }: { arg: MutateAddBookingRequest }) => {
        const result = await mutateAddBooking({ request: arg })
        if (!result.data) throw new Error("addBooking answered no data")
        return result.data.addBooking
    })

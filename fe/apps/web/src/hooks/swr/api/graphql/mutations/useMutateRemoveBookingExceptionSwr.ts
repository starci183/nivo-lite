import useSWRMutation from "swr/mutation"
import { mutateRemoveBookingException } from "@/modules/api/graphql/mutations"
import type { MutateRemoveBookingExceptionRequest } from "@/modules/api/graphql/mutations/types/remove-booking-exception"

/** The SWR key of the `removeBookingException` mutation. */
export const MUTATE_REMOVE_BOOKING_EXCEPTION_SWR_KEY = "MUTATE_REMOVE_BOOKING_EXCEPTION_SWR"

/** Removes a date exception. */
export const useMutateRemoveBookingExceptionSwr = () =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_EXCEPTION_SWR_KEY, async (_key: string, { arg }: { arg: MutateRemoveBookingExceptionRequest }) => {
        const result = await mutateRemoveBookingException({ request: arg })
        if (!result.data) throw new Error("removeBookingException answered no data")
        return result.data.removeBookingException
    })

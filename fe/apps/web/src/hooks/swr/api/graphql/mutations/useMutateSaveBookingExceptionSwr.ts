import useSWRMutation from "swr/mutation"
import { mutateSaveBookingException } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingExceptionRequest } from "@/modules/api/graphql/mutations/types/save-booking-exception"

/** The SWR key of the `saveBookingException` mutation. */
export const MUTATE_SAVE_BOOKING_EXCEPTION_SWR_KEY = "MUTATE_SAVE_BOOKING_EXCEPTION_SWR"

/** Adds a closing or a special opening window on one date. */
export const useMutateSaveBookingExceptionSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_BOOKING_EXCEPTION_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateSaveBookingExceptionRequest }) => {
            const result = await mutateSaveBookingException({ request: arg })
            if (!result.data) throw new Error("saveBookingException answered no data")
            return result.data.saveBookingException
        },
    )

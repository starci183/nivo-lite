import useSWRMutation from "swr/mutation"
import { mutateSaveBookingService } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingServiceRequest } from "@/modules/api/graphql/mutations/types/save-booking-service"

/** The SWR key of the `saveBookingService` mutation. */
export const MUTATE_SAVE_BOOKING_SERVICE_SWR_KEY = "MUTATE_SAVE_BOOKING_SERVICE_SWR"

/** Creates or updates a booking service (id null creates). */
export const useMutateSaveBookingServiceSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_BOOKING_SERVICE_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateSaveBookingServiceRequest }) => {
            const result = await mutateSaveBookingService({ request: arg })
            if (!result.data) throw new Error("saveBookingService answered no data")
            return result.data.saveBookingService
        },
    )

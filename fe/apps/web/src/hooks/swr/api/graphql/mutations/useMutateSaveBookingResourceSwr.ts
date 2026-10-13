import useSWRMutation from "swr/mutation"
import { mutateSaveBookingResource } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingResourceRequest } from "@/modules/api/graphql/mutations/types/save-booking-resource"

/** The SWR key of the `saveBookingResource` mutation. */
export const MUTATE_SAVE_BOOKING_RESOURCE_SWR_KEY = "MUTATE_SAVE_BOOKING_RESOURCE_SWR"

/** Creates or updates a booking resource. */
export const useMutateSaveBookingResourceSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_BOOKING_RESOURCE_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateSaveBookingResourceRequest }) => {
            const result = await mutateSaveBookingResource({ request: arg })
            if (!result.data) throw new Error("saveBookingResource answered no data")
            return result.data.saveBookingResource
        },
    )

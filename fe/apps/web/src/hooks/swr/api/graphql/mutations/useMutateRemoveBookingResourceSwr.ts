import useSWRMutation from "swr/mutation"
import { mutateRemoveBookingResource } from "@/modules/api/graphql/mutations"
import type { MutateRemoveBookingResourceRequest } from "@/modules/api/graphql/mutations/types/remove-booking-resource"

/** The SWR key of the `removeBookingResource` mutation. */
export const MUTATE_REMOVE_BOOKING_RESOURCE_SWR_KEY = "MUTATE_REMOVE_BOOKING_RESOURCE_SWR"

/** Removes a booking resource. */
export const useMutateRemoveBookingResourceSwr = () =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_RESOURCE_SWR_KEY, async (_key: string, { arg }: { arg: MutateRemoveBookingResourceRequest }) => {
        const result = await mutateRemoveBookingResource({ request: arg })
        if (!result.data) throw new Error("removeBookingResource answered no data")
        return result.data.removeBookingResource
    })

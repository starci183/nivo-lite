"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveBookingResource } from "@/modules/api/graphql/mutations/mutation-save-booking-resource"
import type { MutateSaveBookingResourceRequest } from "@/modules/api/graphql/mutations/types/save-booking-resource"

/** The SWR key of the `saveBookingResource` mutation. */
export const MUTATE_SAVE_BOOKING_RESOURCE_SWR_KEY = "MUTATE_SAVE_BOOKING_RESOURCE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveBookingResourceRequest
}

/** Creates or updates a booking resource. */
export const useMutateSaveBookingResourceSwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_RESOURCE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveBookingResource({ request: arg })
        if (!result.data) throw new Error("saveBookingResource answered no data")
        return result.data.saveBookingResource
    })

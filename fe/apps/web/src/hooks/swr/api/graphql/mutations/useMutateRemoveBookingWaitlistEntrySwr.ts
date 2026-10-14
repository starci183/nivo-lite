"use client"

import useSWRMutation from "swr/mutation"
import { mutateRemoveBookingWaitlistEntry } from "@/modules/api/graphql/mutations/mutation-remove-booking-waitlist-entry"
import type { MutateRemoveBookingWaitlistEntryRequest } from "@/modules/api/graphql/mutations/types/remove-booking-waitlist-entry"

/** The SWR key of the `removeBookingWaitlistEntry` mutation. */
export const MUTATE_REMOVE_BOOKING_WAITLIST_ENTRY_SWR_KEY = "MUTATE_REMOVE_BOOKING_WAITLIST_ENTRY_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateRemoveBookingWaitlistEntryRequest
}

/** Removes one entry of the waiting list. */
export const useMutateRemoveBookingWaitlistEntrySwr = () =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_WAITLIST_ENTRY_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateRemoveBookingWaitlistEntry({ request: arg })
        if (!result.data) throw new Error("removeBookingWaitlistEntry answered no data")
        return result.data.removeBookingWaitlistEntry
    })

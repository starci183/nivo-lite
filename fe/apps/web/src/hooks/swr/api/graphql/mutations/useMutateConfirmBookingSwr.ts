"use client"

import useSWRMutation from "swr/mutation"
import { mutateConfirmBooking } from "@/modules/api/graphql/mutations/mutation-confirm-booking"
import type { MutateConfirmBookingRequest } from "@/modules/api/graphql/mutations/types/confirm-booking"

/** The SWR key of the `confirmBooking` mutation. */
export const MUTATE_CONFIRM_BOOKING_SWR_KEY = "MUTATE_CONFIRM_BOOKING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateConfirmBookingRequest
}

/** Confirms a requested booking. */
export const useMutateConfirmBookingSwr = () =>
    useSWRMutation(MUTATE_CONFIRM_BOOKING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateConfirmBooking({ request: arg })
        if (!result.data) throw new Error("confirmBooking answered no data")
        return result.data.confirmBooking
    })

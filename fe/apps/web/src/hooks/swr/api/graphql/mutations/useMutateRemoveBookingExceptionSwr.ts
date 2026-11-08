"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateRemoveBookingException } from "@/modules/api/graphql/mutations/mutation-remove-booking-exception"
import type { MutateRemoveBookingExceptionRequest } from "@/modules/api/graphql/mutations/types/remove-booking-exception"
import type { RemoveBookingExceptionMutation } from "@/modules/api"

/** The SWR key of the `removeBookingException` mutation. */
export const MUTATE_REMOVE_BOOKING_EXCEPTION_SWR_KEY = "MUTATE_REMOVE_BOOKING_EXCEPTION_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateRemoveBookingExceptionRequest
}

/** Removes a date exception. */
export const useMutateRemoveBookingExceptionSwr = (): SWRMutationResponse<
    RemoveBookingExceptionMutation["removeBookingException"],
    Error,
    typeof MUTATE_REMOVE_BOOKING_EXCEPTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_EXCEPTION_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateRemoveBookingException({ request: arg })
        if (!result.data) throw new Error("removeBookingException answered no data")
        return result.data.removeBookingException
    })

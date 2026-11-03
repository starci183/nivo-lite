"use client"

import useSWRMutation from "swr/mutation"
import { mutateCompleteBooking } from "@/modules/api/graphql/mutations/mutation-complete-booking"
import type { MutateCompleteBookingRequest } from "@/modules/api/graphql/mutations/types/complete-booking"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `completeBooking` mutation. */
export const MUTATE_COMPLETE_BOOKING_SWR_KEY = "MUTATE_COMPLETE_BOOKING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateCompleteBookingRequest
}

/** Marks a booking done. */
export const useMutateCompleteBookingSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCompleteBooking>["completeBooking"],
    Error,
    typeof MUTATE_COMPLETE_BOOKING_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_COMPLETE_BOOKING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateCompleteBooking({ request: arg })
        if (!result.data) throw new Error("completeBooking answered no data")
        return result.data.completeBooking
    })

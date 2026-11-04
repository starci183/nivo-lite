"use client"

import useSWRMutation from "swr/mutation"
import { mutateMoveBooking } from "@/modules/api/graphql/mutations/mutation-move-booking"
import type { MutateMoveBookingRequest } from "@/modules/api/graphql/mutations/types/move-booking"
import type { SWRMutationResponse } from "swr/mutation"
import type { MoveBookingMutation } from "@/modules/api"

/** The SWR key of the `moveBooking` mutation. */
export const MUTATE_MOVE_BOOKING_SWR_KEY = "MUTATE_MOVE_BOOKING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateMoveBookingRequest
}

/** Moves a booking to another start time or resource. */
export const useMutateMoveBookingSwr = (): SWRMutationResponse<
    MoveBookingMutation["moveBooking"],
    Error,
    typeof MUTATE_MOVE_BOOKING_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_MOVE_BOOKING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateMoveBooking({ request: arg })
        if (!result.data) throw new Error("moveBooking answered no data")
        return result.data.moveBooking
    })

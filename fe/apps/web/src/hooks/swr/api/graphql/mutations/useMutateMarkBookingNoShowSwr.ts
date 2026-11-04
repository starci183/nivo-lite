"use client"

import useSWRMutation from "swr/mutation"
import { mutateMarkBookingNoShow } from "@/modules/api/graphql/mutations/mutation-mark-booking-no-show"
import type { MutateMarkBookingNoShowRequest } from "@/modules/api/graphql/mutations/types/mark-booking-no-show"
import type { SWRMutationResponse } from "swr/mutation"
import type { MarkBookingNoShowMutation } from "@/modules/api"

/** The SWR key of the `markBookingNoShow` mutation. */
export const MUTATE_MARK_BOOKING_NO_SHOW_SWR_KEY = "MUTATE_MARK_BOOKING_NO_SHOW_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateMarkBookingNoShowRequest
}

/** Marks a booking as a no-show. */
export const useMutateMarkBookingNoShowSwr = (): SWRMutationResponse<
    MarkBookingNoShowMutation["markBookingNoShow"],
    Error,
    typeof MUTATE_MARK_BOOKING_NO_SHOW_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_MARK_BOOKING_NO_SHOW_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateMarkBookingNoShow({ request: arg })
        if (!result.data) throw new Error("markBookingNoShow answered no data")
        return result.data.markBookingNoShow
    })

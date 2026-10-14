"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveBookingHours } from "@/modules/api/graphql/mutations/mutation-save-booking-hours"
import type { MutateSaveBookingHoursRequest } from "@/modules/api/graphql/mutations/types/save-booking-hours"

/** The SWR key of the `saveBookingHours` mutation. */
export const MUTATE_SAVE_BOOKING_HOURS_SWR_KEY = "MUTATE_SAVE_BOOKING_HOURS_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveBookingHoursRequest
}

/** Replaces the weekly hours of one resource. */
export const useMutateSaveBookingHoursSwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_HOURS_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveBookingHours({ request: arg })
        if (!result.data) throw new Error("saveBookingHours answered no data")
        return result.data.saveBookingHours
    })

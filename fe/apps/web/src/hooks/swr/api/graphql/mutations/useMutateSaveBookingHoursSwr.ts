import useSWRMutation from "swr/mutation"
import { mutateSaveBookingHours } from "@/modules/api/graphql/mutations"
import type { MutateSaveBookingHoursRequest } from "@/modules/api/graphql/mutations/types/save-booking-hours"

/** The SWR key of the `saveBookingHours` mutation. */
export const MUTATE_SAVE_BOOKING_HOURS_SWR_KEY = "MUTATE_SAVE_BOOKING_HOURS_SWR"

/** Replaces the weekly hours of one resource. */
export const useMutateSaveBookingHoursSwr = () =>
    useSWRMutation(MUTATE_SAVE_BOOKING_HOURS_SWR_KEY, async (_key: string, { arg }: { arg: MutateSaveBookingHoursRequest }) => {
        const result = await mutateSaveBookingHours({ request: arg })
        if (!result.data) throw new Error("saveBookingHours answered no data")
        return result.data.saveBookingHours
    })

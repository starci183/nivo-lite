import useSWRMutation from "swr/mutation"
import { mutateRequestPublicBooking } from "@/modules/api/graphql/mutations"
import type { MutateRequestPublicBookingRequest } from "@/modules/api/graphql/mutations/types/request-public-booking"

/** The SWR key of the `requestPublicBooking` mutation. */
export const MUTATE_REQUEST_PUBLIC_BOOKING_SWR_KEY = "MUTATE_REQUEST_PUBLIC_BOOKING_SWR"

/** Sends one public booking request (idempotent on token; website is the bot trap). */
export const useMutateRequestPublicBookingSwr = () =>
    useSWRMutation(MUTATE_REQUEST_PUBLIC_BOOKING_SWR_KEY, async (_key: string, { arg }: { arg: MutateRequestPublicBookingRequest }) => {
        const result = await mutateRequestPublicBooking({ request: arg })
        if (!result.data) throw new Error("requestPublicBooking answered no data")
        return result.data.requestPublicBooking
    })

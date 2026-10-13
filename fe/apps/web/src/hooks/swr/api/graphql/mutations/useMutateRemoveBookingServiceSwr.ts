import useSWRMutation from "swr/mutation"
import { mutateRemoveBookingService } from "@/modules/api/graphql/mutations/mutation-remove-booking-service"
import type { MutateRemoveBookingServiceRequest } from "@/modules/api/graphql/mutations/types/remove-booking-service"

/** The SWR key of the `removeBookingService` mutation. */
export const MUTATE_REMOVE_BOOKING_SERVICE_SWR_KEY = "MUTATE_REMOVE_BOOKING_SERVICE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateRemoveBookingServiceRequest
}

/** Removes a booking service. */
export const useMutateRemoveBookingServiceSwr = () =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_SERVICE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateRemoveBookingService({ request: arg })
        if (!result.data) throw new Error("removeBookingService answered no data")
        return result.data.removeBookingService
    })

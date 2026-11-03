"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveBookingService } from "@/modules/api/graphql/mutations/mutation-save-booking-service"
import type { MutateSaveBookingServiceRequest } from "@/modules/api/graphql/mutations/types/save-booking-service"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `saveBookingService` mutation. */
export const MUTATE_SAVE_BOOKING_SERVICE_SWR_KEY = "MUTATE_SAVE_BOOKING_SERVICE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveBookingServiceRequest
}

/** Creates or updates a booking service (id null creates). */
export const useMutateSaveBookingServiceSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveBookingService>["saveBookingService"],
    Error,
    typeof MUTATE_SAVE_BOOKING_SERVICE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_BOOKING_SERVICE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveBookingService({ request: arg })
        if (!result.data) throw new Error("saveBookingService answered no data")
        return result.data.saveBookingService
    })

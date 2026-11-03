"use client"

import useSWRMutation from "swr/mutation"
import { mutateRemoveBookingResource } from "@/modules/api/graphql/mutations/mutation-remove-booking-resource"
import type { MutateRemoveBookingResourceRequest } from "@/modules/api/graphql/mutations/types/remove-booking-resource"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `removeBookingResource` mutation. */
export const MUTATE_REMOVE_BOOKING_RESOURCE_SWR_KEY = "MUTATE_REMOVE_BOOKING_RESOURCE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateRemoveBookingResourceRequest
}

/** Removes a booking resource. */
export const useMutateRemoveBookingResourceSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRemoveBookingResource>["removeBookingResource"],
    Error,
    typeof MUTATE_REMOVE_BOOKING_RESOURCE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_REMOVE_BOOKING_RESOURCE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateRemoveBookingResource({ request: arg })
        if (!result.data) throw new Error("removeBookingResource answered no data")
        return result.data.removeBookingResource
    })

"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRemoveShiftsAvailability,
    type MutateRemoveShiftsAvailabilityRequest,
} from "@/modules/api/graphql/mutations/mutation-remove-shifts-availability"
import type { SWRMutationResponse } from "swr/mutation"
import type { RemoveShiftsAvailabilityMutation } from "@/modules/api"

/** What the removeShiftsAvailability mutation is triggered with. */
interface RemoveShiftsAvailabilityArg {
    readonly arg: MutateRemoveShiftsAvailabilityRequest
}

/** The SWR key of the `removeShiftsAvailability` mutation. */
export const MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateRemoveShiftsAvailability}: `trigger(request)` answers `removeShiftsAvailability` and rejects with the back end failure. */
export const useMutateRemoveShiftsAvailabilitySwr = (): SWRMutationResponse<
    RemoveShiftsAvailabilityMutation["removeShiftsAvailability"],
    Error,
    typeof MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR_KEY,
    RemoveShiftsAvailabilityArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR_KEY,
        async (_key: string, { arg }: RemoveShiftsAvailabilityArg) => {
            const result = await mutateRemoveShiftsAvailability({ request: arg })
            if (!result.data) throw new Error("removeShiftsAvailability answered no data")
            return result.data.removeShiftsAvailability
        },
    )

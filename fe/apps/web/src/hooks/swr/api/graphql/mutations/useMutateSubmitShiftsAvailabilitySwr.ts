"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSubmitShiftsAvailability,
    type MutateSubmitShiftsAvailabilityRequest,
} from "@/modules/api/graphql/mutations/mutation-submit-shifts-availability"
import type { SWRMutationResponse } from "swr/mutation"
import type { SubmitShiftsAvailabilityMutation } from "@/modules/api"

/** What the submitShiftsAvailability mutation is triggered with. */
interface SubmitShiftsAvailabilityArg {
    readonly arg: MutateSubmitShiftsAvailabilityRequest
}

/** The SWR key of the `submitShiftsAvailability` mutation. */
export const MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateSubmitShiftsAvailability}: `trigger(request)` answers `submitShiftsAvailability` and rejects with the back end failure. */
export const useMutateSubmitShiftsAvailabilitySwr = (): SWRMutationResponse<
    SubmitShiftsAvailabilityMutation["submitShiftsAvailability"],
    Error,
    typeof MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR_KEY,
    SubmitShiftsAvailabilityArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR_KEY,
        async (_key: string, { arg }: SubmitShiftsAvailabilityArg) => {
            const result = await mutateSubmitShiftsAvailability({ request: arg })
            if (!result.data) throw new Error("submitShiftsAvailability answered no data")
            return result.data.submitShiftsAvailability
        },
    )

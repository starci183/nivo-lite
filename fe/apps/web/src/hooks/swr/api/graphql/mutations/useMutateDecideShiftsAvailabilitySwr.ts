"use client"

import useSWRMutation from "swr/mutation"
import { mutateDecideShiftsAvailability } from "@/modules/api/graphql/mutations/mutation-decide-shifts-availability"
import type { MutateDecideShiftsAvailabilityRequest } from "@/modules/api/graphql/mutations/mutation-decide-shifts-availability"

/** What the decideShiftsAvailability mutation is triggered with. */
interface DecideShiftsAvailabilityArg {
    readonly arg: MutateDecideShiftsAvailabilityRequest
}

/** The SWR key of the `decideShiftsAvailability` mutation. */
export const MUTATE_DECIDE_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_DECIDE_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateDecideShiftsAvailability}: `trigger(request)` answers `decideShiftsAvailability` and rejects with the back end failure. */
export const useMutateDecideShiftsAvailabilitySwr = () =>
    useSWRMutation(
        MUTATE_DECIDE_SHIFTS_AVAILABILITY_SWR_KEY,
        async (_key: string, { arg }: DecideShiftsAvailabilityArg) => {
            const result = await mutateDecideShiftsAvailability({ request: arg })
            if (!result.data) throw new Error("decideShiftsAvailability answered no data")
            return result.data.decideShiftsAvailability
        },
    )

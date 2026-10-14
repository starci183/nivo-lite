"use client"

import useSWRMutation from "swr/mutation"
import { mutateAddShiftsAvailability } from "@/modules/api/graphql/mutations/mutation-add-shifts-availability"
import type { MutateAddShiftsAvailabilityRequest } from "@/modules/api/graphql/mutations/mutation-add-shifts-availability"

/** What the addShiftsAvailability mutation is triggered with. */
interface AddShiftsAvailabilityArg {
    readonly arg: MutateAddShiftsAvailabilityRequest
}

/** The SWR key of the `addShiftsAvailability` mutation. */
export const MUTATE_ADD_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_ADD_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateAddShiftsAvailability}: `trigger(request)` answers `addShiftsAvailability` and rejects with the back end failure. */
export const useMutateAddShiftsAvailabilitySwr = () =>
    useSWRMutation(MUTATE_ADD_SHIFTS_AVAILABILITY_SWR_KEY, async (_key: string, { arg }: AddShiftsAvailabilityArg) => {
        const result = await mutateAddShiftsAvailability({ request: arg })
        if (!result.data) throw new Error("addShiftsAvailability answered no data")
        return result.data.addShiftsAvailability
    })

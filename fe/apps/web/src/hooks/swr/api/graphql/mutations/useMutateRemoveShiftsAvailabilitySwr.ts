import useSWRMutation from "swr/mutation"
import { mutateRemoveShiftsAvailability } from "@/modules/api/graphql/mutations/mutation-remove-shifts-availability"
import type { MutateRemoveShiftsAvailabilityRequest } from "@/modules/api/graphql/mutations/mutation-remove-shifts-availability"

/** What the removeShiftsAvailability mutation is triggered with. */
interface RemoveShiftsAvailabilityArg {
    readonly arg: MutateRemoveShiftsAvailabilityRequest
}

/** The SWR key of the `removeShiftsAvailability` mutation. */
export const MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateRemoveShiftsAvailability}: `trigger(request)` answers `removeShiftsAvailability` and rejects with the back end failure. */
export const useMutateRemoveShiftsAvailabilitySwr = () =>
    useSWRMutation(MUTATE_REMOVE_SHIFTS_AVAILABILITY_SWR_KEY, async (_key: string, { arg }: RemoveShiftsAvailabilityArg) => {
        const result = await mutateRemoveShiftsAvailability({ request: arg })
        if (!result.data) throw new Error("removeShiftsAvailability answered no data")
        return result.data.removeShiftsAvailability
    })

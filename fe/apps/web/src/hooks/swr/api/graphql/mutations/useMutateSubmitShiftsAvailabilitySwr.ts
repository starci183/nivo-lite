import useSWRMutation from "swr/mutation"
import { mutateSubmitShiftsAvailability } from "@/modules/api/graphql/mutations/mutation-submit-shifts-availability"
import type { MutateSubmitShiftsAvailabilityRequest } from "@/modules/api/graphql/mutations/mutation-submit-shifts-availability"

/** What the submitShiftsAvailability mutation is triggered with. */
interface SubmitShiftsAvailabilityArg {
    readonly arg: MutateSubmitShiftsAvailabilityRequest
}

/** The SWR key of the `submitShiftsAvailability` mutation. */
export const MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR_KEY = "MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateSubmitShiftsAvailability}: `trigger(request)` answers `submitShiftsAvailability` and rejects with the back end failure. */
export const useMutateSubmitShiftsAvailabilitySwr = () =>
    useSWRMutation(
        MUTATE_SUBMIT_SHIFTS_AVAILABILITY_SWR_KEY,
        async (_key: string, { arg }: SubmitShiftsAvailabilityArg) => {
            const result = await mutateSubmitShiftsAvailability({ request: arg })
            if (!result.data) throw new Error("submitShiftsAvailability answered no data")
            return result.data.submitShiftsAvailability
        },
    )

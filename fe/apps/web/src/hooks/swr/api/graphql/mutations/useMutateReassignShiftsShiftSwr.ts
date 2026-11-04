"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateReassignShiftsShift,
    type MutateReassignShiftsShiftRequest,
} from "@/modules/api/graphql/mutations/mutation-reassign-shifts-shift"
import type { SWRMutationResponse } from "swr/mutation"
import type { ReassignShiftsShiftMutation } from "@/modules/api"

/** What the reassignShiftsShift mutation is triggered with. */
interface ReassignShiftsShiftArg {
    readonly arg: MutateReassignShiftsShiftRequest
}

/** The SWR key of the `reassignShiftsShift` mutation. */
export const MUTATE_REASSIGN_SHIFTS_SHIFT_SWR_KEY = "MUTATE_REASSIGN_SHIFTS_SHIFT_SWR"

/** SWR mutation for {@link mutateReassignShiftsShift}: `trigger(request)` answers `reassignShiftsShift` and rejects with the back end failure. */
export const useMutateReassignShiftsShiftSwr = (): SWRMutationResponse<
    ReassignShiftsShiftMutation["reassignShiftsShift"],
    Error,
    typeof MUTATE_REASSIGN_SHIFTS_SHIFT_SWR_KEY,
    ReassignShiftsShiftArg["arg"]
> =>
    useSWRMutation(MUTATE_REASSIGN_SHIFTS_SHIFT_SWR_KEY, async (_key: string, { arg }: ReassignShiftsShiftArg) => {
        const result = await mutateReassignShiftsShift({ request: arg })
        if (!result.data) throw new Error("reassignShiftsShift answered no data")
        return result.data.reassignShiftsShift
    })

"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestShiftsLeave } from "@/modules/api/graphql/mutations/mutation-request-shifts-leave"
import type { MutateRequestShiftsLeaveRequest } from "@/modules/api/graphql/mutations/mutation-request-shifts-leave"

/** What the requestShiftsLeave mutation is triggered with. */
interface RequestShiftsLeaveArg {
    readonly arg: MutateRequestShiftsLeaveRequest
}

/** The SWR key of the `requestShiftsLeave` mutation. */
export const MUTATE_REQUEST_SHIFTS_LEAVE_SWR_KEY = "MUTATE_REQUEST_SHIFTS_LEAVE_SWR"

/** SWR mutation for {@link mutateRequestShiftsLeave}: `trigger(request)` answers `requestShiftsLeave` and rejects with the back end failure. */
export const useMutateRequestShiftsLeaveSwr = () =>
    useSWRMutation(MUTATE_REQUEST_SHIFTS_LEAVE_SWR_KEY, async (_key: string, { arg }: RequestShiftsLeaveArg) => {
        const result = await mutateRequestShiftsLeave({ request: arg })
        if (!result.data) throw new Error("requestShiftsLeave answered no data")
        return result.data.requestShiftsLeave
    })

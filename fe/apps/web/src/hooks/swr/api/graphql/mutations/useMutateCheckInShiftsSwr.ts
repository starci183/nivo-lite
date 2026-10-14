"use client"

import useSWRMutation from "swr/mutation"
import { mutateCheckInShifts } from "@/modules/api/graphql/mutations/mutation-check-in-shifts"
import type { MutateCheckInShiftsRequest } from "@/modules/api/graphql/mutations/mutation-check-in-shifts"

/** What the checkInShifts mutation is triggered with. */
interface CheckInShiftsArg {
    readonly arg: MutateCheckInShiftsRequest
}

/** The SWR key of the `checkInShifts` mutation. */
export const MUTATE_CHECK_IN_SHIFTS_SWR_KEY = "MUTATE_CHECK_IN_SHIFTS_SWR"

/** SWR mutation for {@link mutateCheckInShifts}: `trigger(request)` answers `checkInShifts` and rejects with the back end failure. */
export const useMutateCheckInShiftsSwr = () =>
    useSWRMutation(MUTATE_CHECK_IN_SHIFTS_SWR_KEY, async (_key: string, { arg }: CheckInShiftsArg) => {
        const result = await mutateCheckInShifts({ request: arg })
        if (!result.data) throw new Error("checkInShifts answered no data")
        return result.data.checkInShifts
    })

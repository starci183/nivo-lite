"use client"

import useSWRMutation from "swr/mutation"
import { mutateRemoveShiftsPosition } from "@/modules/api/graphql/mutations/mutation-remove-shifts-position"
import type { MutateRemoveShiftsPositionRequest } from "@/modules/api/graphql/mutations/mutation-remove-shifts-position"

/** What the removeShiftsPosition mutation is triggered with. */
interface RemoveShiftsPositionArg {
    readonly arg: MutateRemoveShiftsPositionRequest
}

/** The SWR key of the `removeShiftsPosition` mutation. */
export const MUTATE_REMOVE_SHIFTS_POSITION_SWR_KEY = "MUTATE_REMOVE_SHIFTS_POSITION_SWR"

/** SWR mutation for {@link mutateRemoveShiftsPosition}: `trigger(request)` answers `removeShiftsPosition` and rejects with the back end failure. */
export const useMutateRemoveShiftsPositionSwr = () =>
    useSWRMutation(MUTATE_REMOVE_SHIFTS_POSITION_SWR_KEY, async (_key: string, { arg }: RemoveShiftsPositionArg) => {
        const result = await mutateRemoveShiftsPosition({ request: arg })
        if (!result.data) throw new Error("removeShiftsPosition answered no data")
        return result.data.removeShiftsPosition
    })

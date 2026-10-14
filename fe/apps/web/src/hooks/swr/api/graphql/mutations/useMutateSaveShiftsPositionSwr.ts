"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveShiftsPosition } from "@/modules/api/graphql/mutations/mutation-save-shifts-position"
import type { MutateSaveShiftsPositionRequest } from "@/modules/api/graphql/mutations/mutation-save-shifts-position"

/** What the saveShiftsPosition mutation is triggered with. */
interface SaveShiftsPositionArg {
    readonly arg: MutateSaveShiftsPositionRequest
}

/** The SWR key of the `saveShiftsPosition` mutation. */
export const MUTATE_SAVE_SHIFTS_POSITION_SWR_KEY = "MUTATE_SAVE_SHIFTS_POSITION_SWR"

/** SWR mutation for {@link mutateSaveShiftsPosition}: `trigger(request)` answers `saveShiftsPosition` and rejects with the back end failure. */
export const useMutateSaveShiftsPositionSwr = () =>
    useSWRMutation(MUTATE_SAVE_SHIFTS_POSITION_SWR_KEY, async (_key: string, { arg }: SaveShiftsPositionArg) => {
        const result = await mutateSaveShiftsPosition({ request: arg })
        if (!result.data) throw new Error("saveShiftsPosition answered no data")
        return result.data.saveShiftsPosition
    })

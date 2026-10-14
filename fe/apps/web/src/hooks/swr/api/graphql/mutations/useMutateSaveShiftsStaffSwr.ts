"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveShiftsStaff } from "@/modules/api/graphql/mutations/mutation-save-shifts-staff"
import type { MutateSaveShiftsStaffRequest } from "@/modules/api/graphql/mutations/mutation-save-shifts-staff"

/** What the saveShiftsStaff mutation is triggered with. */
interface SaveShiftsStaffArg {
    readonly arg: MutateSaveShiftsStaffRequest
}

/** The SWR key of the `saveShiftsStaff` mutation. */
export const MUTATE_SAVE_SHIFTS_STAFF_SWR_KEY = "MUTATE_SAVE_SHIFTS_STAFF_SWR"

/** SWR mutation for {@link mutateSaveShiftsStaff}: `trigger(request)` answers `saveShiftsStaff` and rejects with the back end failure. */
export const useMutateSaveShiftsStaffSwr = () =>
    useSWRMutation(MUTATE_SAVE_SHIFTS_STAFF_SWR_KEY, async (_key: string, { arg }: SaveShiftsStaffArg) => {
        const result = await mutateSaveShiftsStaff({ request: arg })
        if (!result.data) throw new Error("saveShiftsStaff answered no data")
        return result.data.saveShiftsStaff
    })

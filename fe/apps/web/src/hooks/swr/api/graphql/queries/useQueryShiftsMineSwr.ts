"use client"

import useSWR from "swr"
import { queryShiftsMine } from "@/modules/api/graphql/queries/query-shifts-mine"

/** The SWR key of the `shiftsMine` query. */
export const QUERY_SHIFTS_MINE_SWR_KEY = "QUERY_SHIFTS_MINE_SWR"

/** The `shiftsMine` query through SWR. */
export const useQueryShiftsMineSwr = () =>
    useSWR(QUERY_SHIFTS_MINE_SWR_KEY, async () => {
        const result = await queryShiftsMine()
        if (!result.data) throw new Error("shiftsMine answered no data")
        return result.data.shiftsMine
    })

"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryShiftsMine } from "@/modules/api/graphql/queries/query-shifts-mine"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the `shiftsMine` query. */
export const QUERY_SHIFTS_MINE_SWR_KEY = "QUERY_SHIFTS_MINE_SWR"

/** The `shiftsMine` query through SWR. */
export const useQueryShiftsMineSwr = (
    isActive = true,
): ReadResponse<OperationData<typeof queryShiftsMine>["shiftsMine"]> =>
    useSWR(useWorkspaceKey(QUERY_SHIFTS_MINE_SWR_KEY, [], isActive), async () => {
        const result = await queryShiftsMine()
        if (!result.data) throw new Error("shiftsMine answered no data")
        return result.data.shiftsMine
    })

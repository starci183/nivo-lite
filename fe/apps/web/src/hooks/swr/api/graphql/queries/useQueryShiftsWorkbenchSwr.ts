"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import {
    queryShiftsWorkbench,
    type QueryShiftsWorkbenchRequest,
} from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { ShiftsWorkbenchQuery } from "@/modules/api"

/** The SWR key of the `shiftsWorkbench` query. */
export const QUERY_SHIFTS_WORKBENCH_SWR_KEY = "QUERY_SHIFTS_WORKBENCH_SWR"

/** The `shiftsWorkbench` query through SWR; `undefined` suspends the read. */
export const useQueryShiftsWorkbenchSwr = (
    request: QueryShiftsWorkbenchRequest | undefined,
): ReadResponse<ShiftsWorkbenchQuery["shiftsWorkbench"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_SHIFTS_WORKBENCH_SWR_KEY, request === undefined ? null : [request]),
        async ([, , input]: WorkspaceReadKey<NonNullable<typeof request>>) =>
            answeredData(await queryShiftsWorkbench({ request: input }), QUERY_SHIFTS_WORKBENCH_SWR_KEY)
                .shiftsWorkbench,
    )

"use client"

import { answeredData } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryShiftsWorkbench } from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { QueryShiftsWorkbenchRequest } from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the `shiftsWorkbench` query. */
export const QUERY_SHIFTS_WORKBENCH_SWR_KEY = "QUERY_SHIFTS_WORKBENCH_SWR"

/** The `shiftsWorkbench` query through SWR; `undefined` suspends the read. */
export const useQueryShiftsWorkbenchSwr = (
    request: QueryShiftsWorkbenchRequest | undefined,
): ReadResponse<OperationData<typeof queryShiftsWorkbench>["shiftsWorkbench"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_SHIFTS_WORKBENCH_SWR_KEY, request === undefined ? null : [request]),
        async ([, , input]: WorkspaceReadKey<NonNullable<typeof request>>) =>
            answeredData(await queryShiftsWorkbench({ request: input }), QUERY_SHIFTS_WORKBENCH_SWR_KEY)
                .shiftsWorkbench,
    )

"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryShiftsWorkbench } from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { QueryShiftsWorkbenchRequest } from "@/modules/api/graphql/queries/query-shifts-workbench"

/** The SWR key of the `shiftsWorkbench` query. */
export const QUERY_SHIFTS_WORKBENCH_SWR_KEY = "QUERY_SHIFTS_WORKBENCH_SWR"

/** The `shiftsWorkbench` query through SWR; `undefined` suspends the read. */
export const useQueryShiftsWorkbenchSwr = (request: QueryShiftsWorkbenchRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_SHIFTS_WORKBENCH_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryShiftsWorkbench({ request: input }), QUERY_SHIFTS_WORKBENCH_SWR_KEY)
                .shiftsWorkbench,
    )

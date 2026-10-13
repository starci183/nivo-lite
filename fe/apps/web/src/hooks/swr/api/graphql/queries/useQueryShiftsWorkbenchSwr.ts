import useSWR from "swr"
import { queryShiftsWorkbench } from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { QueryShiftsWorkbenchRequest } from "@/modules/api/graphql/queries/query-shifts-workbench"

/** The SWR key of the `shiftsWorkbench` query. */
export const QUERY_SHIFTS_WORKBENCH_SWR_KEY = "QUERY_SHIFTS_WORKBENCH_SWR"

/** The `shiftsWorkbench` query through SWR; `undefined` suspends the read. */
export const useQueryShiftsWorkbenchSwr = (request: QueryShiftsWorkbenchRequest | undefined) =>
    useSWR(request === undefined ? null : [QUERY_SHIFTS_WORKBENCH_SWR_KEY, request], async ([, req]) => {
        const result = await queryShiftsWorkbench({ request: req })
        if (!result.data) throw new Error("shiftsWorkbench answered no data")
        return result.data.shiftsWorkbench
    })
